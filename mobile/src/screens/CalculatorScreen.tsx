import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useResponsive } from '../utils/responsive';

function CalculatorScreen() {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const responsive = useResponsive();

  const handleNumberPress = (num: string) => {
    if (waitingForNewValue) {
      setDisplay(num);
      setWaitingForNewValue(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const handleOperationPress = (op: string) => {
    const currentValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(currentValue);
    } else if (operation) {
      const result = calculate(previousValue, currentValue, operation);
      setDisplay(String(result));
      setPreviousValue(result);
    }

    setWaitingForNewValue(true);
    setOperation(op);
  };

  const calculate = (prev: number, current: number, op: string): number => {
    switch (op) {
      case '+':
        return prev + current;
      case '-':
        return prev - current;
      case '×':
        return prev * current;
      case '÷':
        return current !== 0 ? prev / current : 0;
      default:
        return current;
    }
  };

  const handleEquals = () => {
    if (previousValue !== null && operation) {
      const currentValue = parseFloat(display);
      const result = calculate(previousValue, currentValue, operation);
      setDisplay(String(result));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForNewValue(true);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForNewValue(false);
  };

  const handleDecimal = () => {
    if (waitingForNewValue) {
      setDisplay('0.');
      setWaitingForNewValue(false);
    } else if (display.indexOf('.') === -1) {
      setDisplay(display + '.');
    }
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const formatDisplay = (value: string): string => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    
    // Format large numbers with commas
    if (Math.abs(num) >= 1000000) {
      return num.toExponential(3);
    }
    
    // Format with commas for readability
    const parts = value.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const Button = ({ 
    label, 
    onPress, 
    style = 'default', 
    flex = 1 
  }: { 
    label: string; 
    onPress: () => void; 
    style?: 'default' | 'operation' | 'equals' | 'clear';
    flex?: number;
  }) => {
    const buttonStyles = {
      default: styles.button,
      operation: styles.operationButton,
      equals: styles.equalsButton,
      clear: styles.clearButton,
    };

    const textStyles = {
      default: styles.buttonText,
      operation: styles.operationButtonText,
      equals: styles.equalsButtonText,
      clear: styles.clearButtonText,
    };

    const fontSize = responsive.isTablet ? 32 : 24;

    return (
      <TouchableOpacity
        style={[buttonStyles[style], { flex, minHeight: responsive.isTablet ? 80 : 70 }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={[textStyles[style], { fontSize }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const dynamicStyles = {
    container: {
      ...styles.container,
      padding: responsive.padding.medium,
    },
    display: {
      ...styles.display,
      fontSize: responsive.isTablet ? 64 : 48,
      padding: responsive.padding.large,
    },
    buttonRow: {
      ...styles.buttonRow,
      marginBottom: responsive.spacing.xs,
    },
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={dynamicStyles.container}>
        <View style={styles.displayContainer}>
          <Text style={dynamicStyles.display} numberOfLines={1} adjustsFontSizeToFit>
            {formatDisplay(display)}
          </Text>
        </View>

        <View style={styles.buttonsContainer}>
          <View style={dynamicStyles.buttonRow}>
            <Button label="C" onPress={handleClear} style="clear" />
            <Button label="⌫" onPress={handleBackspace} style="operation" />
            <Button label="÷" onPress={() => handleOperationPress('÷')} style="operation" />
            <Button label="×" onPress={() => handleOperationPress('×')} style="operation" />
          </View>

          <View style={dynamicStyles.buttonRow}>
            <Button label="7" onPress={() => handleNumberPress('7')} />
            <Button label="8" onPress={() => handleNumberPress('8')} />
            <Button label="9" onPress={() => handleNumberPress('9')} />
            <Button label="-" onPress={() => handleOperationPress('-')} style="operation" />
          </View>

          <View style={dynamicStyles.buttonRow}>
            <Button label="4" onPress={() => handleNumberPress('4')} />
            <Button label="5" onPress={() => handleNumberPress('5')} />
            <Button label="6" onPress={() => handleNumberPress('6')} />
            <Button label="+" onPress={() => handleOperationPress('+')} style="operation" />
          </View>

          <View style={dynamicStyles.buttonRow}>
            <Button label="1" onPress={() => handleNumberPress('1')} />
            <Button label="2" onPress={() => handleNumberPress('2')} />
            <Button label="3" onPress={() => handleNumberPress('3')} />
            <Button 
              label="=" 
              onPress={handleEquals} 
              style="equals" 
              flex={1} 
            />
          </View>

          <View style={dynamicStyles.buttonRow}>
            <Button label="0" onPress={() => handleNumberPress('0')} flex={2} />
            <Button label="." onPress={handleDecimal} />
            <Button 
              label="=" 
              onPress={handleEquals} 
              style="equals" 
              flex={1} 
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'flex-end',
  },
  displayContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  display: {
    color: '#ffffff',
    fontWeight: '300',
    textAlign: 'right',
    minHeight: 60,
  },
  buttonsContainer: {
    paddingBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  button: {
    backgroundColor: '#333333',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '400',
  },
  operationButton: {
    backgroundColor: '#ff9500',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  operationButtonText: {
    color: '#ffffff',
    fontWeight: '500',
  },
  equalsButton: {
    backgroundColor: '#ff9500',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  equalsButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#a6a6a6',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  clearButtonText: {
    color: '#000000',
    fontWeight: '500',
  },
});

export default CalculatorScreen;

