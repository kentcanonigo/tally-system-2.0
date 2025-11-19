import React, { useReducer } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResponsive } from '../utils/responsive';

type Operator = '+' | '-' | '×' | '÷' | null;

interface CalculatorState {
  displayValue: string;
  storedValue: number | null;
  operator: Operator;
  isEnteringNewNumber: boolean;
}

type CalculatorAction =
  | { type: 'input_digit'; digit: string }
  | { type: 'input_decimal' }
  | { type: 'clear' }
  | { type: 'backspace' }
  | { type: 'set_operator'; operator: Exclude<Operator, null> }
  | { type: 'evaluate' };

const INITIAL_STATE: CalculatorState = {
  displayValue: '0',
  storedValue: null,
  operator: null,
  isEnteringNewNumber: true,
};

function parseNumericValue(value: string): number {
  if (value === 'Error') return NaN;
  const sanitized = value.replace(/,/g, '');
  return Number(sanitized);
}

function performOperation(
  left: number,
  right: number,
  operator: Exclude<Operator, null>,
): number {
  switch (operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '×':
      return left * right;
    case '÷':
      return right === 0 ? NaN : left / right;
    default:
      return right;
  }
}

function calculatorReducer(
  state: CalculatorState,
  action: CalculatorAction,
): CalculatorState {
  if (state.displayValue === 'Error' && action.type !== 'clear') {
    return state;
  }

  switch (action.type) {
    case 'input_digit': {
      const shouldResetDisplay =
        state.isEnteringNewNumber || state.displayValue === '0';

      const nextDisplay = shouldResetDisplay
        ? action.digit
        : `${state.displayValue}${action.digit}`;

      return {
        ...state,
        displayValue: nextDisplay,
        isEnteringNewNumber: false,
      };
    }

    case 'input_decimal': {
      if (state.isEnteringNewNumber) {
        return {
          ...state,
          displayValue: '0.',
          isEnteringNewNumber: false,
        };
      }

      if (state.displayValue.includes('.')) {
        return state;
      }

      return {
        ...state,
        displayValue: `${state.displayValue}.`,
      };
    }

    case 'clear':
      return INITIAL_STATE;

    case 'backspace': {
      if (state.isEnteringNewNumber) {
        return {
          ...state,
          displayValue: '0',
        };
      }

      if (state.displayValue.length <= 1) {
        return {
          ...state,
          displayValue: '0',
          isEnteringNewNumber: true,
        };
      }

      return {
        ...state,
        displayValue: state.displayValue.slice(0, -1),
      };
    }

    case 'set_operator': {
      const currentValue = parseNumericValue(state.displayValue);

      if (Number.isNaN(currentValue)) {
        return {
          ...INITIAL_STATE,
          displayValue: 'Error',
        };
      }

      if (state.storedValue === null || state.operator === null) {
        return {
          ...state,
          storedValue: currentValue,
          operator: action.operator,
          isEnteringNewNumber: true,
        };
      }

      const result = performOperation(
        state.storedValue,
        currentValue,
        state.operator,
      );

      if (Number.isNaN(result)) {
        return {
          ...INITIAL_STATE,
          displayValue: 'Error',
        };
      }

      return {
        displayValue: String(result),
        storedValue: result,
        operator: action.operator,
        isEnteringNewNumber: true,
      };
    }

    case 'evaluate': {
      if (state.storedValue === null || state.operator === null) {
        return state;
      }

      const currentValue = parseNumericValue(state.displayValue);

      if (Number.isNaN(currentValue)) {
        return {
          ...INITIAL_STATE,
          displayValue: 'Error',
        };
      }

      const result = performOperation(
        state.storedValue,
        currentValue,
        state.operator,
      );

      if (Number.isNaN(result)) {
        return {
          ...INITIAL_STATE,
          displayValue: 'Error',
        };
      }

      return {
        displayValue: String(result),
        storedValue: null,
        operator: null,
        isEnteringNewNumber: true,
      };
    }

    default:
      return state;
  }
}

function formatDisplay(value: string): string {
  if (value === 'Error') return value;
  if (value.toLowerCase().includes('e')) return value;

  const isNegative = value.startsWith('-');
  const cleaned = isNegative ? value.slice(1) : value;
  const [integerPart, decimalPart] = cleaned.split('.');

  const integerNumber = Number(integerPart);
  if (Number.isNaN(integerNumber)) return '0';

  const formattedInteger = integerPart.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ',',
  );

  const prefix = isNegative ? '-' : '';

  if (decimalPart !== undefined && decimalPart.length > 0) {
    return `${prefix}${formattedInteger}.${decimalPart}`;
  }

  if (cleaned.endsWith('.')) {
    return `${prefix}${formattedInteger}.`;
  }

  return `${prefix}${formattedInteger}`;
}

interface CalculatorButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'default' | 'operator' | 'control' | 'equals';
  flex?: number;
  accessibilityLabel?: string;
}

const CalculatorScreen: React.FC = () => {
  const [state, dispatch] = useReducer(
    calculatorReducer,
    INITIAL_STATE,
  );
  const responsive = useResponsive();

  const displayFontSize = responsive.isTablet ? 64 : 48;
  const buttonFontSize = responsive.isTablet ? 28 : 22;
  const buttonMinHeight = responsive.isTablet ? 80 : 64;
  const horizontalPadding = responsive.padding?.medium ?? 16;
  const verticalSpacing = responsive.spacing?.sm ?? 8;

  function handleDigitPress(digit: string) {
    dispatch({ type: 'input_digit', digit });
  }

  function handleOperatorPress(operator: Exclude<Operator, null>) {
    dispatch({ type: 'set_operator', operator });
  }

  function handleDecimalPress() {
    dispatch({ type: 'input_decimal' });
  }

  function handleClearPress() {
    dispatch({ type: 'clear' });
  }

  function handleBackspacePress() {
    dispatch({ type: 'backspace' });
  }

  function handleEvaluatePress() {
    dispatch({ type: 'evaluate' });
  }

  const CalculatorButton = ({
    label,
    onPress,
    variant = 'default',
    flex = 1,
    accessibilityLabel,
  }: CalculatorButtonProps) => {
    const baseStyle = (() => {
      switch (variant) {
        case 'operator':
          return styles.operatorButton;
        case 'equals':
          return styles.equalsButton;
        case 'control':
          return styles.controlButton;
        default:
          return styles.button;
      }
    })();

    const textStyle = (() => {
      switch (variant) {
        case 'operator':
          return styles.operatorButtonText;
        case 'equals':
          return styles.equalsButtonText;
        case 'control':
          return styles.controlButtonText;
        default:
          return styles.buttonText;
      }
    })();

    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          baseStyle,
          {
            flex,
            minHeight: buttonMinHeight,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
      >
        <Text
          style={[
            textStyle,
            {
              fontSize: buttonFontSize,
            },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View
        style={[
          styles.container,
          {
            paddingHorizontal: horizontalPadding,
            paddingTop: responsive.isTablet ? 32 : 16,
          },
        ]}
      >
        <View style={styles.displayContainer}>
          <Text
            style={[styles.display, { fontSize: displayFontSize }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityRole="text"
            accessibilityLabel={`Result: ${state.displayValue}`}
          >
            {formatDisplay(state.displayValue)}
          </Text>
        </View>

        <View style={styles.buttonsContainer}>
          <View
            style={[
              styles.buttonRow,
              { marginBottom: verticalSpacing },
            ]}
          >
            <CalculatorButton
              label="C"
              variant="control"
              onPress={handleClearPress}
              accessibilityLabel="Clear"
            />
            <CalculatorButton
              label="⌫"
              variant="control"
              onPress={handleBackspacePress}
              accessibilityLabel="Backspace"
            />
            <CalculatorButton
              label="÷"
              variant="operator"
              onPress={() => handleOperatorPress('÷')}
            />
            <CalculatorButton
              label="×"
              variant="operator"
              onPress={() => handleOperatorPress('×')}
            />
          </View>

          <View
            style={[
              styles.buttonRow,
              { marginBottom: verticalSpacing },
            ]}
          >
            <CalculatorButton
              label="7"
              onPress={() => handleDigitPress('7')}
            />
            <CalculatorButton
              label="8"
              onPress={() => handleDigitPress('8')}
            />
            <CalculatorButton
              label="9"
              onPress={() => handleDigitPress('9')}
            />
            <CalculatorButton
              label="-"
              variant="operator"
              onPress={() => handleOperatorPress('-')}
            />
          </View>

          <View
            style={[
              styles.buttonRow,
              { marginBottom: verticalSpacing },
            ]}
          >
            <CalculatorButton
              label="4"
              onPress={() => handleDigitPress('4')}
            />
            <CalculatorButton
              label="5"
              onPress={() => handleDigitPress('5')}
            />
            <CalculatorButton
              label="6"
              onPress={() => handleDigitPress('6')}
            />
            <CalculatorButton
              label="+"
              variant="operator"
              onPress={() => handleOperatorPress('+')}
            />
          </View>

          <View
            style={[
              styles.buttonRow,
              { marginBottom: verticalSpacing },
            ]}
          >
            <CalculatorButton
              label="1"
              onPress={() => handleDigitPress('1')}
            />
            <CalculatorButton
              label="2"
              onPress={() => handleDigitPress('2')}
            />
            <CalculatorButton
              label="3"
              onPress={() => handleDigitPress('3')}
            />
            <CalculatorButton
              label="="
              variant="equals"
              onPress={handleEvaluatePress}
              accessibilityLabel="Equals"
            />
          </View>

          <View style={styles.buttonRow}>
            <CalculatorButton
              label="0"
              flex={2}
              onPress={() => handleDigitPress('0')}
            />
            <CalculatorButton
              label="."
              onPress={handleDecimalPress}
            />
            <CalculatorButton
              label="="
              variant="equals"
              onPress={handleEvaluatePress}
              accessibilityLabel="Equals"
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#f5f5f5',
  },
  displayContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginBottom: 16,
    alignItems: 'flex-end',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    minHeight: 96,
  },
  display: {
    color: '#1f2933',
    fontWeight: '500',
    textAlign: 'right',
    minHeight: 60,
  },
  buttonsContainer: {
    paddingBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 10,
  },
  button: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e4e7eb',
  },
  buttonText: {
    color: '#1f2933',
    fontWeight: '500',
  },
  operatorButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
  operatorButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  equalsButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
  },
  equalsButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  controlButton: {
    backgroundColor: '#f97316',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
  controlButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

export default CalculatorScreen;
