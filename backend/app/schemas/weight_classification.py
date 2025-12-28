from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from datetime import datetime
from typing import Optional, Literal


# Define allowed category values
CategoryType = Literal['Dressed', 'Byproduct', 'Frozen']


class WeightClassificationBase(BaseModel):
    classification: str
    description: Optional[str] = None  # Optional for Dressed, required for Byproduct
    min_weight: Optional[float] = None  # Nullable for catch-all
    max_weight: Optional[float] = None  # Nullable for "up" ranges and catch-all
    category: CategoryType
    default_heads: Optional[float] = 15.0  # Default number of heads for this classification

    @field_validator('category')
    @classmethod
    def validate_category(cls, v: str) -> str:
        allowed_categories = ['Dressed', 'Byproduct', 'Frozen']
        if v not in allowed_categories:
            raise ValueError(f'category must be one of: {", ".join(allowed_categories)}')
        return v
    
    @field_validator('default_heads')
    @classmethod
    def validate_default_heads(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError('default_heads must be non-negative')
        return v

    @model_validator(mode='after')
    def validate_description_and_weights(self):
        # Validate description: required for Byproduct, optional for Dressed and Frozen
        if self.category == 'Byproduct':
            if not self.description or not self.description.strip():
                raise ValueError('description is required for Byproduct category')
            # Skip weight validation for byproducts - they don't have weight ranges
            return self
        
        # Validate weights for Dressed and Frozen categories (same rules)
        # Catch-all: both min and max must be null
        if self.min_weight is None and self.max_weight is None:
            return self  # Valid catch-all
        
        # "Down" range: min_weight is null, max_weight is set (means <= max_weight)
        if self.min_weight is None and self.max_weight is not None:
            return self  # Valid "down" range (up to X)
        
        # "Up" range: min_weight is set, max_weight is null (means >= min_weight)
        if self.min_weight is not None and self.max_weight is None:
            return self  # Valid "up" range (X and up)
        
        # Regular range: both min and max are set
        if self.min_weight is not None and self.max_weight is not None:
            if self.max_weight < self.min_weight:
                raise ValueError('max_weight must be greater than or equal to min_weight')
            return self
        
        return self


class WeightClassificationCreate(WeightClassificationBase):
    plant_id: int


class WeightClassificationUpdate(BaseModel):
    classification: Optional[str] = None
    description: Optional[str] = None
    min_weight: Optional[float] = None
    max_weight: Optional[float] = None
    category: Optional[CategoryType] = None
    default_heads: Optional[float] = None

    @field_validator('category')
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed_categories = ['Dressed', 'Byproduct', 'Frozen']
        if v not in allowed_categories:
            raise ValueError(f'category must be one of: {", ".join(allowed_categories)}')
        return v
    
    @field_validator('default_heads')
    @classmethod
    def validate_default_heads(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError('default_heads must be non-negative')
        return v

    @model_validator(mode='after')
    def validate_description_and_weights(self):
        # Note: For updates, we can't fully validate description requirement without the existing category
        # The validation will be handled at the API/CRUD level if needed
        # If category is being updated to Byproduct, description should be provided
        
        # Skip weight validation for byproducts - they don't have weight ranges
        if self.category == 'Byproduct':
            return self
        
        # Only validate weights if at least one weight is being set and category is Dressed or Frozen
        if self.min_weight is None and self.max_weight is None:
            return self  # No weights being updated, skip validation
        
        # If both are being set, validate the range
        if self.min_weight is not None and self.max_weight is not None:
            if self.max_weight < self.min_weight:
                raise ValueError('max_weight must be greater than or equal to min_weight')
        
        # All other combinations are valid (partial updates will be merged with existing data)
        return self


class WeightClassificationResponse(WeightClassificationBase):
    id: int
    plant_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

