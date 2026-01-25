import { useState, useCallback, useMemo } from "react";

/**
 * Reglas de validación predefinidas
 */
export const validators = {
  required: (value, message = "Este campo es requerido") => {
    if (value === null || value === undefined || value === "") {
      return message;
    }
    if (Array.isArray(value) && value.length === 0) {
      return message;
    }
    return null;
  },

  email: (value, message = "Email inválido") => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? null : message;
  },

  minLength: (min, message) => (value) => {
    if (!value) return null;
    const msg = message || `Mínimo ${min} caracteres`;
    return value.length >= min ? null : msg;
  },

  maxLength: (max, message) => (value) => {
    if (!value) return null;
    const msg = message || `Máximo ${max} caracteres`;
    return value.length <= max ? null : msg;
  },

  min: (minValue, message) => (value) => {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    const msg = message || `El valor mínimo es ${minValue}`;
    return num >= minValue ? null : msg;
  },

  max: (maxValue, message) => (value) => {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    const msg = message || `El valor máximo es ${maxValue}`;
    return num <= maxValue ? null : msg;
  },

  pattern: (regex, message = "Formato inválido") => (value) => {
    if (!value) return null;
    return regex.test(value) ? null : message;
  },

  phone: (value, message = "Teléfono inválido") => {
    if (!value) return null;
    // Venezuelan phone format: 7 digits
    const phoneRegex = /^\d{7}$/;
    return phoneRegex.test(value.replace(/\D/g, "")) ? null : message;
  },

  cedula: (value, message = "Cédula inválida") => {
    if (!value) return null;
    // Venezuelan cedula: 6-8 digits
    const cedulaRegex = /^\d{6,8}$/;
    return cedulaRegex.test(value.replace(/\D/g, "")) ? null : message;
  },

  positiveNumber: (value, message = "Debe ser un número positivo") => {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    return num > 0 ? null : message;
  },

  integer: (value, message = "Debe ser un número entero") => {
    if (value === null || value === undefined || value === "") return null;
    return Number.isInteger(Number(value)) ? null : message;
  },

  match: (fieldName, getValue, message) => (value) => {
    if (!value) return null;
    const otherValue = getValue();
    const msg = message || `Debe coincidir con ${fieldName}`;
    return value === otherValue ? null : msg;
  },

  custom: (validatorFn) => validatorFn,
};

/**
 * Hook para validación de formularios
 * 
 * @param {Object} initialValues - Valores iniciales del formulario
 * @param {Object} validationRules - Reglas de validación por campo
 * @returns {Object} - Estado y funciones del formulario
 * 
 * @example
 * const { values, errors, touched, handleChange, handleBlur, validate, isValid } = useFormValidation(
 *   { email: "", password: "" },
 *   {
 *     email: [validators.required, validators.email],
 *     password: [validators.required, validators.minLength(8)],
 *   }
 * );
 */
export function useFormValidation(initialValues = {}, validationRules = {}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Validar un campo específico
  const validateField = useCallback((name, value) => {
    const rules = validationRules[name];
    if (!rules) return null;

    const rulesArray = Array.isArray(rules) ? rules : [rules];
    
    for (const rule of rulesArray) {
      const error = typeof rule === "function" ? rule(value, values) : null;
      if (error) return error;
    }
    
    return null;
  }, [validationRules, values]);

  // Validar todos los campos
  const validateAll = useCallback(() => {
    const newErrors = {};
    let isValid = true;

    Object.keys(validationRules).forEach((name) => {
      const error = validateField(name, values[name]);
      if (error) {
        newErrors[name] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    
    // Marcar todos los campos como touched
    const allTouched = {};
    Object.keys(validationRules).forEach((name) => {
      allTouched[name] = true;
    });
    setTouched(allTouched);

    return isValid;
  }, [validateField, validationRules, values]);

  // Manejar cambio de valor
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;
    
    setValues((prev) => ({ ...prev, [name]: newValue }));
    
    // Limpiar error cuando el usuario empieza a escribir
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
    
    // Limpiar error de submit
    if (submitError) {
      setSubmitError(null);
    }
  }, [errors, submitError]);

  // Manejar blur (para validación en tiempo real)
  const handleBlur = useCallback((e) => {
    const { name, value } = e.target;
    
    setTouched((prev) => ({ ...prev, [name]: true }));
    
    const error = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  }, [validateField]);

  // Establecer valor programáticamente
  const setValue = useCallback((name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  }, [errors]);

  // Establecer múltiples valores
  const setFormValues = useCallback((newValues) => {
    setValues((prev) => ({ ...prev, ...newValues }));
    
    // Limpiar errores de los campos actualizados
    const clearedErrors = {};
    Object.keys(newValues).forEach((name) => {
      clearedErrors[name] = null;
    });
    setErrors((prev) => ({ ...prev, ...clearedErrors }));
  }, []);

  // Establecer error programáticamente
  const setFieldError = useCallback((name, error) => {
    setErrors((prev) => ({ ...prev, [name]: error }));
    setTouched((prev) => ({ ...prev, [name]: true }));
  }, []);

  // Reset del formulario
  const reset = useCallback((newValues = initialValues) => {
    setValues(newValues);
    setErrors({});
    setTouched({});
    setSubmitError(null);
    setIsSubmitting(false);
  }, [initialValues]);

  // Verificar si el formulario es válido
  const isValid = useMemo(() => {
    return Object.values(errors).every((error) => !error);
  }, [errors]);

  // Verificar si un campo tiene error visible
  const getFieldError = useCallback((name) => {
    return touched[name] ? errors[name] : null;
  }, [touched, errors]);

  // Props helper para Input
  const getInputProps = useCallback((name) => ({
    name,
    value: values[name] || "",
    onChange: handleChange,
    onBlur: handleBlur,
    error: touched[name] && errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  }), [values, handleChange, handleBlur, touched, errors]);

  // Props helper para Select
  const getSelectProps = useCallback((name) => ({
    name,
    value: values[name] || "",
    onValueChange: (value) => setValue(name, value),
    error: touched[name] && errors[name],
  }), [values, setValue, touched, errors]);

  // Manejar submit
  const handleSubmit = useCallback((onSubmit) => async (e) => {
    e?.preventDefault();
    
    if (!validateAll()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onSubmit(values);
    } catch (error) {
      setSubmitError(error.message || "Error al enviar el formulario");
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [validateAll, values]);

  return {
    // Estado
    values,
    errors,
    touched,
    isSubmitting,
    submitError,
    isValid,
    
    // Funciones de manejo
    handleChange,
    handleBlur,
    handleSubmit,
    
    // Setters
    setValue,
    setFormValues,
    setFieldError,
    setSubmitError,
    setIsSubmitting,
    
    // Validación
    validateField,
    validateAll,
    getFieldError,
    
    // Helpers
    getInputProps,
    getSelectProps,
    reset,
  };
}

export default useFormValidation;
