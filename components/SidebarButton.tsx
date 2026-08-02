import React, { forwardRef } from "react";
import { Animated, Pressable, StyleSheet, StyleProp, ViewStyle, PressableProps, TextStyle, View, Platform } from "react-native";
import { ThemedText } from "./ThemedText";
import { Colors } from "@/constants/Colors";
import { useButtonAnimation } from "@/hooks/useAnimation";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

interface SidebarButtonProps extends PressableProps {
  children?: React.ReactNode;
  text?: string;
  variant?: "default" | "primary" | "ghost";
  isSelected?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  focusable?: boolean;
  collapsed?: boolean;
}

export const SidebarButton = forwardRef<View, SidebarButtonProps>(
  ({ children, text, variant = "default", isSelected = false, style, textStyle, focusable, collapsed = false, ...rest }, ref) => {
    const colorScheme = "dark";
    const colors = Colors[colorScheme];
    const [isFocused, setIsFocused] = React.useState(false);
    const animationStyle = useButtonAnimation(isFocused);
    const deviceType = useResponsiveLayout().deviceType;

    const variantStyles = {
      default: StyleSheet.create({
        button: {
          backgroundColor: colors.border,
        },
        text: {
          color: colors.text,
        },
        selectedButton: {
          backgroundColor: colors.primary,
        },
        focusedButton: {
          borderColor: colors.primary,
        },
        selectedText: {
          color: Colors.dark.text,
        },
      }),
      primary: StyleSheet.create({
        button: {
          backgroundColor: "transparent",
        },
        text: {
          color: colors.text,
        },
        focusedButton: {
          backgroundColor: colors.primary,
          borderColor: colors.background,
        },
        selectedButton: {
          backgroundColor: colors.primary,
        },
        selectedText: {
          color: colors.link,
        },
      }),
      ghost: StyleSheet.create({
        button: {
          backgroundColor: "transparent",
        },
        text: {
          color: colors.text,
        },
        focusedButton: {
          backgroundColor: "rgba(119, 119, 119, 0.2)",
          borderColor: colors.primary,
        },
        selectedButton: {},
        selectedText: {},
      }),
    };

    const buttonPaddingHorizontal = collapsed ? 4 : 16;
    const buttonPaddingVertical = collapsed ? 8 : 10;

    const styles = StyleSheet.create({
      button: {
        borderRadius: 8,
        borderWidth: 2,
        borderColor: "transparent",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
      },
      focusedButton: {
        backgroundColor: colors.link,
        borderColor: colors.background,
        elevation: 5,
        shadowColor: colors.link,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 15,
      },
      selectedButton: {
        backgroundColor: colors.tint,
      },
      text: {
        fontSize: 16,
        fontWeight: "500",
        color: colors.text,
      },
      selectedText: {
        color: Colors.dark.text,
      },
    });

    return (
      <Animated.View style={[animationStyle, style]}>
        <Pressable
          {...rest}
          android_ripple={Platform.isTV || deviceType !== 'tv'? { color: 'transparent' } : { color: Colors.dark.link }}
          ref={ref}
          focusable={focusable}
          onFocus={focusable !== false ? () => setIsFocused(true) : undefined}
          onBlur={focusable !== false ? () => setIsFocused(false) : undefined}
          style={({ focused }) => [
            styles.button,
            { paddingHorizontal: buttonPaddingHorizontal, paddingVertical: buttonPaddingVertical },
            variantStyles[variant].button,
            isSelected && (variantStyles[variant].selectedButton ?? styles.selectedButton),
            focused && focusable !== false && (variantStyles[variant].focusedButton ?? styles.focusedButton),
          ]}
        >
          {text ? (
            <ThemedText
              style={[
                styles.text,
                variantStyles[variant].text,
                isSelected && (variantStyles[variant].selectedText ?? styles.selectedText),
                textStyle,
              ]}
            >
              {text}
            </ThemedText>
          ) : (
            children
          )}
        </Pressable>
      </Animated.View>
    );
  }
);

SidebarButton.displayName = "SidebarButton";
