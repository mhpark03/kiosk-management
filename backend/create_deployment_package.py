#!/usr/bin/env python3
import zipfile
import os
from pathlib import Path

# Create deployment package with forward slashes (Unix-compatible)
output_file = 'backend-unix-zip.zip'
base_dir = Path('.')

files_to_include = [
    'build/libs/backend-0.0.1-SNAPSHOT.jar',
    'Procfile',
]

# Add .ebextensions directory
ebext_dir = Path('.ebextensions')
if ebext_dir.exists():
    for file in ebext_dir.rglob('*'):
        if file.is_file():
            files_to_include.append(str(file))

# Add .platform directory
platform_dir = Path('.platform')
if platform_dir.exists():
    for file in platform_dir.rglob('*'):
        if file.is_file():
            files_to_include.append(str(file))

print(f"Creating {output_file}...")
with zipfile.ZipFile(output_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for file_path in files_to_include:
        full_path = base_dir / file_path
        if full_path.exists():
            # Always use forward slashes in ZIP
            arcname = str(file_path).replace('\\', '/')
            print(f"  Adding: {arcname}")
            zipf.write(full_path, arcname)
        else:
            print(f"  Warning: {file_path} not found, skipping")

print(f"\n{output_file} created successfully!")
print(f"Size: {os.path.getsize(output_file) / (1024*1024):.1f} MB")
