#!/bin/bash

# Validate all unit JSON files in both units/ and units_generated/
EXIT_CODE=0
VALIDATED=0

# Function to validate units in a directory
validate_units_in_dir() {
    local dir=$1
    local dir_name=$2
    
    if [ -d "$dir" ]; then
        echo "Checking $dir_name directory..."
        for unit_file in $dir/unit-*.json; do
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
    else
        echo "No $dir_name directory found - skipping"
    fi
}

# Validate authored units
validate_units_in_dir "floor-plans/units" "units"

# Validate generated units  
validate_units_in_dir "floor-plans/units_generated" "units_generated"

if [ $VALIDATED -eq 0 ]; then
    echo "No unit files found to validate"
else
    echo "Validated $VALIDATED unit files"
fi

exit $EXIT_CODE