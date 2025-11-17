from pydantic import BaseModel, ConfigDict, field_validator, model_validator
from datetime import datetime
from typing import Optional, Literal


# Define allowed category values
CategoryType = Literal['Dressed', 'Byproduct']


class WeightClassificationBase(BaseModel):
    classification: str
    min_weight: Optional[float] = None  # Nullable for catch-all
    max_weight: Optional[float] = None  # Nullable for "up" ranges and catch-all
    category: CategoryType

    @field_validator('category')
    @classmethod
    def validate_category(cls, v: str) -> str:
        allowed_categories = ['Dressed', 'Byproduct']
        if v not in allowed_categories:
            raise ValueError(f'category must be one of: {", ".join(allowed_categories)}')
        return v

    @model_validator(mode='after')
    def validate_weights(self):
        # Catch-all: both min and max must be null
        if self.min_weight is None and self.max_weight is None:
            return self  # Valid catch-all
        
        # Regular range: min_weight must be set
        if self.min_weight is None:
            raise ValueError('min_weight is required unless this is a catch-all classification (both min and max null)')
        
        # "Up" range: max_weight can be null (means >= min_weight)
        if self.max_weight is not None:
            if self.max_weight < self.min_weight:
                raise ValueError('max_weight must be greater than or equal to min_weight')
        
        return self


class WeightClassificationCreate(WeightClassificationBase):
    plant_id: int


class WeightClassificationUpdate(BaseModel):
    classification: Optional[str] = None
    min_weight: Optional[float] = None
    max_weight: Optional[float] = None
    category: Optional[CategoryType] = None

    @field_validator('category')
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed_categories = ['Dressed', 'Byproduct']
        if v not in allowed_categories:
            raise ValueError(f'category must be one of: {", ".join(allowed_categories)}')
        return v


class WeightClassificationResponse(WeightClassificationBase):
    id: int
    plant_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

