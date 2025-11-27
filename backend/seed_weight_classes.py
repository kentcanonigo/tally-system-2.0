"""
Seed script to add standard weight classes to a selected plant.

Usage:
    python seed_weight_classes.py --plant <plant_name>
    python seed_weight_classes.py --plant "My Plant"

Or from the backend directory:
    python seed_weight_classes.py --plant <plant_name>
"""
import sys
import argparse
from pathlib import Path

# Add parent directory to path to allow imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.crud import (
    plant as plant_crud,
    weight_classification as weight_classification_crud,
)
from app.schemas.weight_classification import WeightClassificationCreate


# Standard Weight Classification Templates
DRESSED_CLASSIFICATIONS = [
    {"classification": "OS", "min_weight": 18.0, "max_weight": None, "description": None},
    {"classification": "P4", "min_weight": 16.50, "max_weight": 17.99, "description": None},
    {"classification": "P3", "min_weight": 15.0, "max_weight": 16.49, "description": None},
    {"classification": "P2", "min_weight": 13.50, "max_weight": 14.99, "description": None},
    {"classification": "P1", "min_weight": 12.00, "max_weight": 13.49, "description": None},
    {"classification": "US", "min_weight": 10.50, "max_weight": 11.99, "description": None},
    {"classification": "SQ", "min_weight": None, "max_weight": 10.49, "description": None},
]

BYPRODUCT_CLASSIFICATIONS = [
    {"classification": "LV", "description": "Liver"},
    {"classification": "GZ", "description": "Gizzard"},
    {"classification": "SI", "description": "Small Intestine"},
    {"classification": "FT", "description": "Feet"},
    {"classification": "PV", "description": "Proven"},
    {"classification": "HD", "description": "Head"},
    {"classification": "BLD", "description": "Blood"},
]


def find_plant_by_name(db: Session, plant_name: str):
    """Find a plant by name (case-insensitive)."""
    all_plants = plant_crud.get_plants(db, skip=0, limit=1000)
    for plant in all_plants:
        if plant.name.lower() == plant_name.lower():
            return plant
    return None


def seed_weight_classes_for_plant(db: Session, plant_name: str) -> dict:
    """
    Seed standard weight classes for a given plant.
    
    Returns a dictionary with counts of created classifications.
    """
    # Find the plant
    plant = find_plant_by_name(db, plant_name)
    if not plant:
        raise ValueError(f"Plant '{plant_name}' not found. Please check the plant name and try again.")
    
    print(f"Found plant: {plant.name} (ID: {plant.id})")
    
    # Get existing weight classifications for this plant
    existing_wcs = weight_classification_crud.get_weight_classifications_by_plant(db, plant.id)
    existing_classifications = {wc.classification for wc in existing_wcs}
    
    created_dressed = 0
    created_byproduct = 0
    skipped_dressed = 0
    skipped_byproduct = 0
    errors = []
    
    # Create Dressed classifications
    print(f"\nSeeding Dressed classifications for {plant.name}...")
    for dc in DRESSED_CLASSIFICATIONS:
        if dc["classification"] in existing_classifications:
            print(f"  ⊘ Skipped (already exists): {dc['classification']}")
            skipped_dressed += 1
            continue
        
        try:
            wc = weight_classification_crud.create_weight_classification(
                db,
                WeightClassificationCreate(
                    plant_id=plant.id,
                    classification=dc["classification"],
                    min_weight=dc["min_weight"],
                    max_weight=dc["max_weight"],
                    description=dc["description"],
                    category="Dressed"
                )
            )
            weight_range = (
                "catch-all" if (dc["min_weight"] is None and dc["max_weight"] is None)
                else f"{dc['min_weight']} and up" if dc["max_weight"] is None
                else f"{dc['max_weight']} and below" if dc["min_weight"] is None
                else f"{dc['min_weight']}-{dc['max_weight']}"
            )
            print(f"  ✓ Created: {wc.classification} ({weight_range})")
            created_dressed += 1
        except Exception as e:
            error_msg = f"  ✗ Failed to create {dc['classification']}: {str(e)}"
            print(error_msg)
            errors.append(error_msg)
    
    # Create Byproduct classifications
    print(f"\nSeeding Byproduct classifications for {plant.name}...")
    for bp in BYPRODUCT_CLASSIFICATIONS:
        if bp["classification"] in existing_classifications:
            print(f"  ⊘ Skipped (already exists): {bp['classification']} ({bp['description']})")
            skipped_byproduct += 1
            continue
        
        try:
            wc = weight_classification_crud.create_weight_classification(
                db,
                WeightClassificationCreate(
                    plant_id=plant.id,
                    classification=bp["classification"],
                    description=bp["description"],
                    min_weight=None,
                    max_weight=None,
                    category="Byproduct"
                )
            )
            print(f"  ✓ Created: {wc.classification} ({wc.description})")
            created_byproduct += 1
        except Exception as e:
            error_msg = f"  ✗ Failed to create {bp['classification']}: {str(e)}"
            print(error_msg)
            errors.append(error_msg)
    
    return {
        "created_dressed": created_dressed,
        "created_byproduct": created_byproduct,
        "skipped_dressed": skipped_dressed,
        "skipped_byproduct": skipped_byproduct,
        "errors": errors
    }


def main():
    """Main function to run the seed script."""
    parser = argparse.ArgumentParser(
        description="Seed standard weight classes (Dressed and Byproduct) for a selected plant."
    )
    parser.add_argument(
        "--plant",
        type=str,
        required=True,
        help="Name of the plant to seed weight classes for"
    )
    
    args = parser.parse_args()
    
    print("\n" + "=" * 80)
    print("🌱 Tally System - Weight Classes Seed Script")
    print("=" * 80 + "\n")
    
    try:
        # Create tables if they don't exist
        print("Ensuring database tables exist...")
        Base.metadata.create_all(bind=engine)
        print("✓ Database tables ready\n")
        
        # Create database session
        db = SessionLocal()
        
        try:
            # Seed weight classes for the specified plant
            results = seed_weight_classes_for_plant(db, args.plant)
            
            # Summary
            print("\n" + "=" * 80)
            print("✓ Weight classes seeding completed!")
            print("=" * 80)
            print(f"Summary for plant '{args.plant}':")
            print(f"  - Dressed classifications created: {results['created_dressed']}")
            print(f"  - Dressed classifications skipped: {results['skipped_dressed']}")
            print(f"  - Byproduct classifications created: {results['created_byproduct']}")
            print(f"  - Byproduct classifications skipped: {results['skipped_byproduct']}")
            if results['errors']:
                print(f"  - Errors: {len(results['errors'])}")
            print("=" * 80 + "\n")
            
            if results['errors']:
                print("Errors encountered:")
                for error in results['errors']:
                    print(f"  {error}")
                print()
                sys.exit(1)
            
        finally:
            db.close()
        
    except ValueError as e:
        print(f"\n✗ Error: {str(e)}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Error running seed script: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

