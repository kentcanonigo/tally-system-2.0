import React, { useState, useEffect } from 'react';
import { weightClassificationsApi, authApi } from '../services/api';
import { WeightClassification } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface ClassificationOrderDialogProps {
  visible: boolean;
  onClose: () => void;
  activePlantId: number | null;
}

// Default order for classifications (case-insensitive matching)
const DEFAULT_DRESSED_ORDER = ['Dressed Chicken', 'os', 'p4', 'p3', 'p2', 'p1', 'us', 'SQ', 'cb'];
const DEFAULT_BYPRODUCT_ORDER = ['lv', 'gz', 'si', 'ft', 'hd', 'pv', 'bld'];

const getDefaultOrder = (category: string): string[] => {
  if (category === 'Dressed') return DEFAULT_DRESSED_ORDER;
  if (category === 'Byproduct') return DEFAULT_BYPRODUCT_ORDER;
  return []; // Frozen: alphabetical
};

const sortByDefaultOrder = (classifications: WeightClassification[], category: string): WeightClassification[] => {
  const defaultOrder = getDefaultOrder(category);
  if (defaultOrder.length === 0) {
    // Alphabetical for Frozen
    return [...classifications].sort((a, b) => 
      a.classification.localeCompare(b.classification, undefined, { sensitivity: 'base' })
    );
  }
  
  const ordered: WeightClassification[] = [];
  const unordered: WeightClassification[] = [];
  const lowerDefaultOrder = defaultOrder.map(c => c.toLowerCase());
  
  // Add classifications in default order
  for (const defaultClass of lowerDefaultOrder) {
    const found = classifications.find(wc => 
      wc.classification.toLowerCase() === defaultClass
    );
    if (found) {
      ordered.push(found);
    }
  }
  
  // Add remaining classifications alphabetically
  for (const wc of classifications) {
    if (!ordered.find(o => o.id === wc.id)) {
      unordered.push(wc);
    }
  }
  unordered.sort((a, b) => 
    a.classification.localeCompare(b.classification, undefined, { sensitivity: 'base' })
  );
  
  return [...ordered, ...unordered];
};

export const ClassificationOrderDialog: React.FC<ClassificationOrderDialogProps> = ({ visible, onClose, activePlantId }) => {
  const { user, refetchUser } = useAuth();
  
  const [classifications, setClassifications] = useState<WeightClassification[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orderedClassifications, setOrderedClassifications] = useState<{
    Dressed: WeightClassification[];
    Frozen: WeightClassification[];
    Byproduct: WeightClassification[];
  }>({ Dressed: [], Frozen: [], Byproduct: [] });

  useEffect(() => {
    if (visible && activePlantId) {
      loadClassifications();
    }
  }, [visible, activePlantId]);

  const loadClassifications = async () => {
    if (!activePlantId) {
      alert('No active plant selected');
      return;
    }

    setLoading(true);
    try {
      const response = await weightClassificationsApi.getByPlant(activePlantId);
      const allClassifications = response.data;
      
      // Group by category
      const grouped = {
        Dressed: allClassifications.filter(wc => wc.category === 'Dressed'),
        Frozen: allClassifications.filter(wc => wc.category === 'Frozen'),
        Byproduct: allClassifications.filter(wc => wc.category === 'Byproduct'),
      };

      // Apply custom order if exists, otherwise use default
      const customOrder = user?.classification_order;
      
      const ordered: typeof grouped = {
        Dressed: applyOrder(grouped.Dressed, customOrder?.Dressed, 'Dressed'),
        Frozen: applyOrder(grouped.Frozen, customOrder?.Frozen, 'Frozen'),
        Byproduct: applyOrder(grouped.Byproduct, customOrder?.Byproduct, 'Byproduct'),
      };

      setClassifications(allClassifications);
      setOrderedClassifications(ordered);
    } catch (error: any) {
      console.error('Error loading classifications:', error);
      alert(error.message || 'Failed to load classifications');
    } finally {
      setLoading(false);
    }
  };

  const applyOrder = (
    items: WeightClassification[],
    customOrder: number[] | undefined,
    category: string
  ): WeightClassification[] => {
    if (customOrder && customOrder.length > 0) {
      // Create a map for quick lookup
      const itemMap = new Map(items.map(item => [item.id, item]));
      const ordered: WeightClassification[] = [];
      const unordered: WeightClassification[] = [];

      // Add items in custom order
      for (const id of customOrder) {
        const item = itemMap.get(id);
        if (item) {
          ordered.push(item);
          itemMap.delete(id);
        }
      }

      // Add remaining items alphabetically
      for (const item of itemMap.values()) {
        unordered.push(item);
      }
      unordered.sort((a, b) => 
        a.classification.localeCompare(b.classification, undefined, { sensitivity: 'base' })
      );

      return [...ordered, ...unordered];
    }

    // Use default order
    return sortByDefaultOrder(items, category);
  };

  const moveItem = (category: 'Dressed' | 'Frozen' | 'Byproduct', index: number, direction: 'up' | 'down') => {
    const items = [...orderedClassifications[category]];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= items.length) return;
    
    [items[index], items[newIndex]] = [items[newIndex], items[index]];
    
    setOrderedClassifications({
      ...orderedClassifications,
      [category]: items,
    });
  };

  const resetToDefault = () => {
    if (!activePlantId) return;
    
    const grouped = {
      Dressed: classifications.filter(wc => wc.category === 'Dressed'),
      Frozen: classifications.filter(wc => wc.category === 'Frozen'),
      Byproduct: classifications.filter(wc => wc.category === 'Byproduct'),
    };

    setOrderedClassifications({
      Dressed: sortByDefaultOrder(grouped.Dressed, 'Dressed'),
      Frozen: sortByDefaultOrder(grouped.Frozen, 'Frozen'),
      Byproduct: sortByDefaultOrder(grouped.Byproduct, 'Byproduct'),
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const classificationOrder: { [category: string]: number[] } = {
        Dressed: orderedClassifications.Dressed.map(wc => wc.id),
        Frozen: orderedClassifications.Frozen.map(wc => wc.id),
        Byproduct: orderedClassifications.Byproduct.map(wc => wc.id),
      };

      await authApi.updatePreferences({ classification_order: classificationOrder });
      await refetchUser();
      alert('Classification order saved successfully');
      onClose();
    } catch (error: any) {
      console.error('Error saving classification order:', error);
      alert(error.message || 'Failed to save classification order');
    } finally {
      setSaving(false);
    }
  };

  const renderCategorySection = (category: 'Dressed' | 'Frozen' | 'Byproduct', title: string) => {
    const items = orderedClassifications[category];
    if (items.length === 0) return null;

    return (
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#2c3e50', marginBottom: '12px' }}>
          {title} ({items.length})
        </h3>
        {items.map((wc, index) => (
          <div
            key={wc.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              borderBottom: '1px solid #f0f0f0',
            }}
          >
            <span style={{ flex: 1, color: '#2c3e50' }}>{wc.classification}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => moveItem(category, index, 'up')}
                disabled={index === 0}
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  backgroundColor: index === 0 ? '#f5f5f5' : '#fff',
                  cursor: index === 0 ? 'not-allowed' : 'pointer',
                  opacity: index === 0 ? 0.5 : 1,
                }}
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveItem(category, index, 'down')}
                disabled={index === items.length - 1}
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  backgroundColor: index === items.length - 1 ? '#f5f5f5' : '#fff',
                  cursor: index === items.length - 1 ? 'not-allowed' : 'pointer',
                  opacity: index === items.length - 1 ? 0.5 : 1,
                }}
                title="Move down"
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          padding: '30px',
          borderRadius: '8px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: '#2c3e50', margin: 0 }}>Customize Classification Order</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#7f8c8d',
              padding: '0',
              width: '30px',
              height: '30px',
            }}
          >
            ×
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div>Loading classifications...</div>
          </div>
        ) : (
          <div style={{ maxHeight: '60vh', overflowY: 'auto', marginBottom: '20px' }}>
            {renderCategorySection('Dressed', 'Dressed Chicken')}
            {renderCategorySection('Frozen', 'Frozen Chicken')}
            {renderCategorySection('Byproduct', 'Byproduct')}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid #e0e0e0', paddingTop: '20px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={resetToDefault}
            disabled={loading || saving}
          >
            Reset to Default
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={loading || saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
