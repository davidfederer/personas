#!/usr/bin/env python3
"""Count the number of files in the data folder."""

import os
from pathlib import Path

def count_files_in_directory(directory_path: str) -> dict:
    """
    Count files in a directory.
    
    Args:
        directory_path: Path to the directory to count files in
        
    Returns:
        Dictionary with counts of total files, JSON files, and other files
    """
    path = Path(directory_path)
    
    if not path.exists():
        print(f"[error] Directory not found: {directory_path}")
        return {"total": 0, "json_files": 0, "other_files": 0}
    
    if not path.is_dir():
        print(f"[error] Path is not a directory: {directory_path}")
        return {"total": 0, "json_files": 0, "other_files": 0}
    
    # Count files (not directories)
    all_files = [f for f in path.iterdir() if f.is_file()]
    json_files = [f for f in all_files if f.suffix.lower() == '.json']
    other_files = [f for f in all_files if f.suffix.lower() != '.json']
    
    counts = {
        "total": len(all_files),
        "json_files": len(json_files),
        "other_files": len(other_files)
    }
    
    return counts


if __name__ == "__main__":
    data_folder = "data"
    
    print(f"[info] Counting files in: {data_folder}")
    counts = count_files_in_directory(data_folder)
    
    print(f"\n[results]")
    print(f"  Total files: {counts['total']}")
    print(f"  JSON files: {counts['json_files']}")
    print(f"  Other files: {counts['other_files']}")
