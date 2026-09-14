import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary Caught Error]:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.icon}>⚠️</Text>
            <Text style={styles.title}>Something went wrong in the App</Text>
            <Text style={styles.subtitle}>
              An unexpected error occurred. You can reload the application to continue smoothly.
            </Text>

            {this.state.error && (
              <ScrollView style={styles.errorBox}>
                <Text style={styles.errorText}>{this.state.error.toString()}</Text>
                {this.state.errorInfo?.componentStack && (
                  <Text style={styles.stackText}>{this.state.errorInfo.componentStack}</Text>
                )}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.button} onPress={this.handleReset} activeOpacity={0.8}>
              <Text style={styles.buttonText}>🔄 Reload Application</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#001F2D',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#00F5D4',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#A0ECED',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorBox: {
    maxHeight: 180,
    width: '100%',
    backgroundColor: 'rgba(255, 71, 87, 0.15)',
    borderColor: '#FF4757',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
  },
  errorText: {
    color: '#FF6B6B',
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 6,
  },
  stackText: {
    color: '#E0E0E0',
    fontSize: 11,
  },
  button: {
    backgroundColor: '#00F5D4',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 4,
  },
  buttonText: {
    color: '#0D2526',
    fontWeight: '900',
    fontSize: 16,
  },
});
