#!/bin/bash

# Validate all unit JSON files
EXIT_CODE=0
VALIDATED=0

# Check if units directory exists
if [ ! -d "floor-plans/units" ]; then
    echo "No units directory found - skipping unit validation"
    exit 0
fi

# Loop through all unit JSON files
for unit_file in floor-plans/units/unit-*.json; do
    if [ -f "$unit_file" ]; then
        echo "Validating: $unit_file"
        node scripts/validate-units.js "$unit_file"
        if [ $? -ne 0 ]; then
            EXIT_CODE=1
            echo "Validation failed for: $unit_file"
        else
            ((VALIDATED++))
        fi
    fi
done

if [ $VALIDATED -eq 0 ]; then
    echo "No unit files found to validate"
else
    echo "Validated $VALIDATED unit files"
fi

exit $EXIT_CODE