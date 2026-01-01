#!/usr/bin/env python3
"""
Update all MIT license headers to proprietary copyright notice
"""

import os
import re
from pathlib import Path

PROPRIETARY_HEADER = """/**
 * Copyright (c) 2025 Philip L. Giacalone. All Rights Reserved.
 *
 * This software and associated documentation files (the "Software") are the
 * proprietary and confidential property of Philip L. Giacalone.
 *
 * Unauthorized copying, modification, distribution, or use of this Software,
 * via any medium, is strictly prohibited and may be subject to civil and
 * criminal penalties.
 *
 * The Software is protected by copyright laws and international copyright
 * treaties, as well as other intellectual property laws and treaties.
 */"""

MIT_LICENSE_PATTERN = re.compile(
    r'/\*\*\s*\n\s*\*\s*Copyright \(c\) \d{4} Philip L\. Giacalone\s*\n\s*\*\s*\n'
    r'(\s*\*.*?\n)*?'
    r'\s*\*/\s*\n',
    re.MULTILINE | re.DOTALL
)

def should_process_file(filepath):
    """Check if file should be processed"""
    exclusions = [
        'node_modules',
        'dist',
        'electron/node_modules',
        'electron/release',
        'electron/app',
        '.git',
        'update_licenses.py',
        'update_licenses.sh'
    ]
    path_str = str(filepath)
    return not any(excl in path_str for excl in exclusions)

def update_file(filepath):
    """Update license header in a single file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if file has MIT license
        if 'Permission is hereby granted' in content:
            # Replace the MIT license header
            new_content = MIT_LICENSE_PATTERN.sub(PROPRIETARY_HEADER + '\n\n', content, count=1)
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                return True
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
    
    return False

def main():
    """Main function"""
    root = Path('.')
    extensions = ['.ts', '.tsx', '.js', '.jsx']
    
    updated_count = 0
    
    for ext in extensions:
        for filepath in root.rglob(f'*{ext}'):
            if should_process_file(filepath) and filepath.is_file():
                if update_file(filepath):
                    print(f"Updated: {filepath}")
                    updated_count += 1
    
    print(f"\nTotal files updated: {updated_count}")

if __name__ == '__main__':
    main()
