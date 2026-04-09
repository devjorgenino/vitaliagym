import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock Button component for testing
const Button = React.forwardRef(({ 
  children, 
  loading, 
  disabled, 
  onClick,
  variant = 'default',
  size = 'default',
  ...props 
}, ref) => (
  <button
    ref={ref}
    disabled={disabled || loading}
    aria-busy={loading ? 'true' : undefined}
    onClick={onClick}
    data-variant={variant}
    data-size={size}
    {...props}
  >
    {loading && <span data-testid="loader">Loading...</span>}
    {children}
  </button>
));
Button.displayName = 'Button';

// Mock Input component for testing
const Input = React.forwardRef(({ 
  error, 
  success,
  ...props 
}, ref) => (
  <input
    ref={ref}
    aria-invalid={error ? 'true' : undefined}
    data-error={error ? 'true' : undefined}
    data-success={success ? 'true' : undefined}
    {...props}
  />
));
Input.displayName = 'Input';

// Mock FormMessage component
const FormMessage = ({ children, variant = 'error', id }) => {
  if (!children) return null;
  return (
    <p 
      id={id} 
      role={variant === 'error' ? 'alert' : undefined}
      data-variant={variant}
    >
      {children}
    </p>
  );
};

describe('Button Component', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows loader when loading', () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('is disabled when loading', () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('sets aria-busy when loading', () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Submit</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('does not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies variant prop', () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'destructive');
  });

  it('applies size prop', () => {
    render(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('data-size', 'lg');
  });
});

describe('Input Component', () => {
  it('renders correctly', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('handles value changes', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);
    
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('sets aria-invalid when error is true', () => {
    render(<Input error="Error message" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('applies error styling', () => {
    render(<Input error="Error message" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('data-error', 'true');
  });

  it('applies success styling', () => {
    render(<Input success />);
    expect(screen.getByRole('textbox')).toHaveAttribute('data-success', 'true');
  });

  it('can be disabled', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('accepts different types', () => {
    render(<Input type="email" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
  });
});

describe('FormMessage Component', () => {
  it('renders children', () => {
    render(<FormMessage>Error message</FormMessage>);
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('returns null when children is empty', () => {
    const { container } = render(<FormMessage>{null}</FormMessage>);
    expect(container).toBeEmptyDOMElement();
  });

  it('has role="alert" for error variant', () => {
    render(<FormMessage variant="error">Error</FormMessage>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('does not have role="alert" for success variant', () => {
    render(<FormMessage variant="success">Success</FormMessage>);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('applies variant data attribute', () => {
    render(<FormMessage variant="success">Success</FormMessage>);
    expect(screen.getByText('Success')).toHaveAttribute('data-variant', 'success');
  });

  it('applies id for aria-describedby', () => {
    render(<FormMessage id="email-error">Invalid email</FormMessage>);
    expect(screen.getByText('Invalid email')).toHaveAttribute('id', 'email-error');
  });
});

describe('Form Integration', () => {
  it('form with validation shows errors on invalid submit', () => {
    const TestForm = () => {
      const [error, setError] = React.useState(null);
      const [inputValue, setInputValue] = React.useState('');
      
      const handleSubmit = (e) => {
        e.preventDefault();
        if (!inputValue) {
          setError('Email es requerido');
        }
      };

      return (
        <form onSubmit={handleSubmit} noValidate>
          <Input 
            name="email" 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            error={error}
            aria-describedby={error ? 'email-error' : undefined}
          />
          <FormMessage id="email-error">{error}</FormMessage>
          <Button type="submit">Submit</Button>
        </form>
      );
    };

    render(<TestForm />);
    
    fireEvent.click(screen.getByText('Submit'));
    
    expect(screen.getByText('Email es requerido')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('form clears error on input', () => {
    const TestForm = () => {
      const [error, setError] = React.useState('Email es requerido');
      
      const handleChange = () => {
        setError(null);
      };

      return (
        <form noValidate>
          <Input 
            name="email" 
            error={error}
            onChange={handleChange}
          />
          <FormMessage>{error}</FormMessage>
        </form>
      );
    };

    render(<TestForm />);
    
    expect(screen.getByText('Email es requerido')).toBeInTheDocument();
    
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
    
    expect(screen.queryByText('Email es requerido')).not.toBeInTheDocument();
  });
});
