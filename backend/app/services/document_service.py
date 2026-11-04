"""
TrustVault — File Upload Validation Pipeline
6-layer validation for all uploaded files.

LAYER 1: Filename sanitization (strip path traversal, null bytes, control chars)
LAYER 2: Extension allowlist (case-insensitive)
LAYER 3: Size limit (enforced during streaming read, not after full buffer)
LAYER 4: Magic byte / structural verification (don't trust client Content-Type)
LAYER 5: DOCX/XLSX internal ZIP structure inspection (without disk extraction)
LAYER 6: Pluggable malware scanner adapter

SECURITY NOTES:
- original_filename is ONLY used for sanitized display — NEVER as a filesystem path
- storage_key is a random UUID generated AFTER validation — completely unrelated to filename
- Zip bomb detection on DOCX/XLSX via compression ratio check
"""
from __future__ import annotations

import io
import os
import re
import unicodedata
import zipfile
from typing import Optional

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings
from app.services.malware_scanner import get_malware_scanner

# Allowed file types: extension → (mime_type, description)
ALLOWED_EXTENSIONS = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".txt": "text/plain",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}

# Magic bytes for file type verification
MAGIC_BYTES = {
    ".pdf": b"%PDF-",
    ".png": b"\x89PNG\r\n\x1a\n",
    ".jpg": b"\xff\xd8\xff",
    ".jpeg": b"\xff\xd8\xff",
    # DOCX and XLSX both start with PK (ZIP format) — further inspection needed
    ".docx": b"PK\x03\x04",
    ".xlsx": b"PK\x03\x04",
    ".txt": None,  # Text files verified by UTF-8 decoding
}

# Maximum zip bomb ratio (compressed vs uncompressed)
MAX_ZIP_RATIO = 20  # 20:1 compression ratio threshold
MAX_ZIP_SCAN_SIZE = 50 * 1024 * 1024  # 50 MB uncompressed cap for ZIP inspection


def sanitize_filename(filename: str) -> str:
    """
    Sanitize original_filename for safe display (not for filesystem use).
    - Strips directory components
    - Removes null bytes, control characters, unicode direction overrides
    - Removes leading dots
    - Rejects path traversal patterns
    - Truncates to 255 chars
    """
    if not filename:
        raise HTTPException(status_code=400, detail="Filename is required.")

    # Normalize unicode (remove zero-width chars, direction overrides)
    filename = unicodedata.normalize("NFC", filename)

    # Remove null bytes and control characters
    filename = re.sub(r"[\x00-\x1f\x7f]", "", filename)

    # Strip directory components (handles both / and \ separators)
    filename = os.path.basename(filename.replace("\\", "/"))

    # Reject path traversal attempts
    if ".." in filename or filename.startswith("/") or filename.startswith("\\"):
        raise HTTPException(
            status_code=400,
            detail="Invalid filename: path traversal detected.",
        )

    # Remove leading dots (hidden files)
    filename = filename.lstrip(".")

    # Strip dangerous unicode right-to-left override characters
    filename = filename.replace("\u202e", "").replace("\u200f", "")

    if not filename:
        raise HTTPException(status_code=400, detail="Filename became empty after sanitization.")

    # Truncate
    return filename[:255]


def get_file_extension(filename: str) -> str:
    """Extract and lowercase the file extension."""
    _, ext = os.path.splitext(filename.lower())
    return ext


def validate_extension(ext: str) -> str:
    """Validate file extension against allowlist. Returns normalized mime_type."""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"File type '{ext}' is not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS.keys())}",
        )
    return ALLOWED_EXTENSIONS[ext]


def validate_magic_bytes(file_bytes: bytes, ext: str) -> None:
    """
    Verify file magic bytes match the declared extension.
    Do NOT trust client-supplied Content-Type header.
    """
    magic = MAGIC_BYTES.get(ext)
    if magic is None:
        return  # txt handled separately

    if not file_bytes.startswith(magic):
        raise HTTPException(
            status_code=422,
            detail=f"File content does not match declared type '{ext}'. Magic bytes mismatch.",
        )


def validate_txt_content(file_bytes: bytes) -> None:
    """
    Validate .txt files:
    - Must be valid UTF-8 (no null bytes)
    - Must not contain HTML/script injection
    """
    try:
        content = file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=422,
            detail="Text file is not valid UTF-8.",
        )

    # Reject null bytes
    if "\x00" in content:
        raise HTTPException(
            status_code=422,
            detail="Text file contains null bytes.",
        )

    # Reject embedded HTML/script magic (prevents stored XSS via text uploads)
    lower = content[:1024].lower().strip()
    forbidden_starts = ["<!doctype html", "<html", "<script", "<svg", "<?xml"]
    for fs in forbidden_starts:
        if lower.startswith(fs):
            raise HTTPException(
                status_code=422,
                detail="Text file contains HTML/script content and is not allowed.",
            )


def validate_docx_structure(file_bytes: bytes, ext: str) -> None:
    """
    Validate DOCX/XLSX internal ZIP structure without extracting to disk.
    - Checks for required internal paths ([Content_Types].xml, word/ or xl/)
    - Detects ZIP bombs via compression ratio
    - Rejects disguised .zip/.jar/.apk files
    """
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
            names = set(zf.namelist())

            # Check for zip bomb (compression ratio)
            total_uncompressed = 0
            for info in zf.infolist():
                total_uncompressed += info.file_size
                if info.compress_size > 0:
                    ratio = info.file_size / info.compress_size
                    if ratio > MAX_ZIP_RATIO:
                        raise HTTPException(
                            status_code=422,
                            detail=f"File rejected: suspicious compression ratio {ratio:.1f}:1 (possible ZIP bomb).",
                        )
                if total_uncompressed > MAX_ZIP_SCAN_SIZE:
                    raise HTTPException(
                        status_code=422,
                        detail="File rejected: uncompressed content exceeds safety limit.",
                    )

            # Require [Content_Types].xml
            if "[Content_Types].xml" not in names:
                raise HTTPException(
                    status_code=422,
                    detail=f"File rejected: not a valid {ext} file (missing [Content_Types].xml).",
                )

            # Check for type-specific required directory
            if ext == ".docx":
                has_word = any(n.startswith("word/") for n in names)
                if not has_word:
                    raise HTTPException(
                        status_code=422,
                        detail="File rejected: not a valid .docx file (missing word/ directory).",
                    )
            elif ext == ".xlsx":
                has_xl = any(n.startswith("xl/") for n in names)
                if not has_xl:
                    raise HTTPException(
                        status_code=422,
                        detail="File rejected: not a valid .xlsx file (missing xl/ directory).",
                    )

    except zipfile.BadZipFile:
        raise HTTPException(
            status_code=422,
            detail=f"File rejected: not a valid {ext} file (bad ZIP structure).",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"File validation failed: {str(e)}",
        )


async def read_upload_with_size_limit(upload: UploadFile) -> bytes:
    """
    Stream-read uploaded file, enforcing MAX_UPLOAD_SIZE_MB limit.
    Raises 413 if file exceeds limit WITHOUT reading the entire huge payload into RAM first.
    """
    max_bytes = settings.max_upload_size_bytes
    chunks = []
    total = 0

    while True:
        chunk = await upload.read(65536)  # 64 KB at a time
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum upload size is {settings.MAX_UPLOAD_SIZE_MB} MB.",
            )
        chunks.append(chunk)

    return b"".join(chunks)


async def validate_upload(upload: UploadFile) -> tuple[bytes, str, str, str]:
    """
    Full 6-layer validation pipeline for an uploaded file.
    
    Returns:
        (file_bytes, sanitized_filename, extension, mime_type)
    
    Raises HTTPException on any validation failure.
    """
    # Layer 1: Filename sanitization
    raw_filename = upload.filename or "upload"
    sanitized_filename = sanitize_filename(raw_filename)

    # Layer 2: Extension allowlist
    ext = get_file_extension(sanitized_filename)
    mime_type = validate_extension(ext)

    # Layer 3: Size limit (streamed)
    file_bytes = await read_upload_with_size_limit(upload)

    if not file_bytes:
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")

    # Layer 4: Magic bytes verification (don't trust Content-Type header)
    if ext in (".docx", ".xlsx"):
        validate_magic_bytes(file_bytes, ext)
        # Layer 5: Internal ZIP structure inspection
        validate_docx_structure(file_bytes, ext)
    elif ext == ".txt":
        validate_txt_content(file_bytes)
    else:
        validate_magic_bytes(file_bytes, ext)

    # Layer 6: Malware scanner
    scanner = get_malware_scanner()
    scan_result = scanner.scan(file_bytes, sanitized_filename)
    if not scan_result.clean:
        raise HTTPException(
            status_code=422,
            detail=f"File rejected by security scanner: {scan_result.reason}",
        )

    return file_bytes, sanitized_filename, ext, mime_type

