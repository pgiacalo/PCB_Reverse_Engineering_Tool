#!/bin/bash
# Script to clean Unicode characters from a project JSON file
# Usage: ./scripts/clean_project_unicode.sh <project_file.json>

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <project_file.json>"
    exit 1
fi

PROJECT_FILE="$1"

if [ ! -f "$PROJECT_FILE" ]; then
    echo "Error: File '$PROJECT_FILE' not found"
    exit 1
fi

# Create backup
BACKUP_FILE="${PROJECT_FILE}.backup"
cp "$PROJECT_FILE" "$BACKUP_FILE"
echo "Created backup: $BACKUP_FILE"

# Replace Unicode characters with ASCII equivalents
sed -i '' 's/µ/u/g; s/Ω/Ohm/g; s/±/+\/-/g' "$PROJECT_FILE"

echo "✓ Cleaned Unicode characters from $PROJECT_FILE"
echo "  µ → u"
echo "  Ω → Ohm"
echo "  ± → +/-"
