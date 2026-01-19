/**
 * Datos comunes para Venezuela
 * - Lista de bancos
 * - Tipos de documento de identidad
 * - Utilidades relacionadas
 */

/**
 * Lista completa de bancos de Venezuela
 * Incluye bancos públicos, privados y digitales
 */
export const VENEZUELAN_BANKS = [
  // Bancos Públicos
  { code: "0102", name: "Banco de Venezuela", shortName: "Venezuela" },
  { code: "0104", name: "Banco Venezolano de Crédito", shortName: "Venezolano de Crédito" },
  { code: "0105", name: "Banco Mercantil", shortName: "Mercantil" },
  { code: "0108", name: "Banco Provincial", shortName: "Provincial" },
  { code: "0114", name: "Bancaribe", shortName: "Bancaribe" },
  { code: "0115", name: "Banco Exterior", shortName: "Exterior" },
  { code: "0116", name: "Banco Occidental de Descuento (BOD)", shortName: "BOD" },
  { code: "0128", name: "Banco Caroní", shortName: "Caroní" },
  { code: "0134", name: "Banesco", shortName: "Banesco" },
  { code: "0137", name: "Banco Sofitasa", shortName: "Sofitasa" },
  { code: "0138", name: "Banco Plaza", shortName: "Plaza" },
  { code: "0146", name: "Bangente", shortName: "Bangente" },
  { code: "0151", name: "BFC Banco Fondo Común", shortName: "BFC" },
  { code: "0156", name: "100% Banco", shortName: "100% Banco" },
  { code: "0157", name: "Banco del Sur", shortName: "Del Sur" },
  { code: "0163", name: "Banco del Tesoro", shortName: "Tesoro" },
  { code: "0166", name: "Banco Agrícola de Venezuela", shortName: "Agrícola" },
  { code: "0168", name: "Bancrecer", shortName: "Bancrecer" },
  { code: "0169", name: "Mi Banco", shortName: "Mi Banco" },
  { code: "0171", name: "Banco Activo", shortName: "Activo" },
  { code: "0172", name: "Bancamiga", shortName: "Bancamiga" },
  { code: "0173", name: "Banco Internacional de Desarrollo", shortName: "BID" },
  { code: "0174", name: "Banplus", shortName: "Banplus" },
  { code: "0175", name: "Banco Bicentenario", shortName: "Bicentenario" },
  { code: "0177", name: "Banco de la Fuerza Armada Nacional (BANFANB)", shortName: "BANFANB" },
  { code: "0191", name: "Banco Nacional de Crédito (BNC)", shortName: "BNC" },
];

/**
 * Tipos de documento de identidad en Venezuela
 * V = Venezolano
 * E = Extranjero
 * J = Jurídico (Empresas)
 * P = Pasaporte
 * G = Gobierno
 */
export const DOCUMENT_TYPES = [
  { 
    value: "V", 
    label: "V", 
    fullLabel: "Venezolano",
    description: "Cédula de ciudadano venezolano" 
  },
  { 
    value: "E", 
    label: "E", 
    fullLabel: "Extranjero",
    description: "Cédula de extranjero residente" 
  },
  { 
    value: "J", 
    label: "J", 
    fullLabel: "Jurídico",
    description: "RIF de persona jurídica (empresa)" 
  },
  { 
    value: "P", 
    label: "P", 
    fullLabel: "Pasaporte",
    description: "Número de pasaporte" 
  },
  { 
    value: "G", 
    label: "G", 
    fullLabel: "Gobierno",
    description: "Entidad gubernamental" 
  },
];

/**
 * Tipos de cuenta bancaria
 */
export const BANK_ACCOUNT_TYPES = [
  { value: "ahorro", label: "Ahorro" },
  { value: "corriente", label: "Corriente" },
];

/**
 * Operadores de telefonía móvil en Venezuela
 * Incluye los principales operadores con sus prefijos
 */
export const PHONE_OPERATORS = [
  // Movistar
  { code: "0414", operator: "Movistar", shortName: "0414" },
  { code: "0424", operator: "Movistar", shortName: "0424" },
  // Movilnet
  { code: "0416", operator: "Movilnet", shortName: "0416" },
  { code: "0426", operator: "Movilnet", shortName: "0426" },
  // Digitel
  { code: "0412", operator: "Digitel", shortName: "0412" },
];

/**
 * Formatear teléfono con prefijo de operador
 * @param {string} operator - Código de operador (0414, 0412, etc.)
 * @param {string} number - Número de teléfono (7 dígitos)
 * @returns {string} Teléfono formateado (ej: "0414-1234567")
 */
export function formatPhone(operator, number) {
  if (!number) return "";
  const cleanNumber = number.replace(/\D/g, "");
  return operator ? `${operator}-${cleanNumber}` : cleanNumber;
}

/**
 * Parsear teléfono formateado
 * @param {string} phone - Teléfono con o sin prefijo de operador
 * @returns {{ operator: string, number: string }}
 */
export function parsePhone(phone) {
  if (!phone) return { operator: "0414", number: "" };
  
  // Limpiar espacios y guiones
  const cleanPhone = phone.replace(/[\s-]/g, "");
  
  // Buscar si comienza con algún código de operador
  for (const op of PHONE_OPERATORS) {
    if (cleanPhone.startsWith(op.code)) {
      return {
        operator: op.code,
        number: cleanPhone.substring(op.code.length),
      };
    }
  }
  
  // Si tiene formato con guión (0414-1234567)
  const match = phone.match(/^(04\d{2})-?(\d+)$/);
  if (match) {
    return {
      operator: match[1],
      number: match[2],
    };
  }
  
  // Si no tiene prefijo válido, asumir 0414 y usar todo como número
  return {
    operator: "0414",
    number: cleanPhone.replace(/^0/, ""), // Quitar 0 inicial si existe
  };
}

/**
 * Validar formato de teléfono
 * @param {string} operator - Código de operador
 * @param {string} number - Número de teléfono
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePhone(operator, number) {
  if (!number || number.trim() === "") {
    return { valid: false, error: "El número de teléfono es requerido" };
  }

  const cleanNumber = number.replace(/\D/g, "");

  // Los números venezolanos tienen 7 dígitos después del prefijo
  if (cleanNumber.length !== 7) {
    return { 
      valid: false, 
      error: "El número debe tener 7 dígitos" 
    };
  }

  // Verificar que el operador sea válido
  const validOperator = PHONE_OPERATORS.find(op => op.code === operator);
  if (!validOperator) {
    return { 
      valid: false, 
      error: "Operador no válido" 
    };
  }

  return { valid: true };
}

/**
 * Obtener banco por código
 */
export function getBankByCode(code) {
  return VENEZUELAN_BANKS.find(bank => bank.code === code);
}

/**
 * Obtener banco por nombre
 */
export function getBankByName(name) {
  return VENEZUELAN_BANKS.find(
    bank => bank.name === name || bank.shortName === name
  );
}

/**
 * Formatear cédula con prefijo
 * @param {string} type - Tipo de documento (V, E, J, P, G)
 * @param {string} number - Número de documento
 * @returns {string} Cédula formateada (ej: "V-12345678")
 */
export function formatCedula(type, number) {
  if (!number) return "";
  const cleanNumber = number.replace(/\D/g, "");
  return type ? `${type}-${cleanNumber}` : cleanNumber;
}

/**
 * Parsear cédula formateada
 * @param {string} cedula - Cédula con o sin prefijo
 * @returns {{ type: string, number: string }}
 */
export function parseCedula(cedula) {
  if (!cedula) return { type: "V", number: "" };
  
  const match = cedula.match(/^([VEJPG])-?(.+)$/i);
  if (match) {
    return {
      type: match[1].toUpperCase(),
      number: match[2].replace(/\D/g, ""),
    };
  }
  
  // Si no tiene prefijo, asumir V
  return {
    type: "V",
    number: cedula.replace(/\D/g, ""),
  };
}

/**
 * Validar formato de cédula
 * @param {string} type - Tipo de documento
 * @param {string} number - Número de documento
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateCedula(type, number) {
  if (!number || number.trim() === "") {
    return { valid: false, error: "El número de documento es requerido" };
  }

  const cleanNumber = number.replace(/\D/g, "");

  if (type === "V" || type === "E") {
    // Cédulas venezolanas/extranjeros: 6-8 dígitos
    if (cleanNumber.length < 6 || cleanNumber.length > 8) {
      return { 
        valid: false, 
        error: "La cédula debe tener entre 6 y 8 dígitos" 
      };
    }
  } else if (type === "J" || type === "G") {
    // RIF: 9 dígitos
    if (cleanNumber.length !== 9) {
      return { 
        valid: false, 
        error: "El RIF debe tener 9 dígitos" 
      };
    }
  } else if (type === "P") {
    // Pasaporte: flexible
    if (cleanNumber.length < 5) {
      return { 
        valid: false, 
        error: "El pasaporte debe tener al menos 5 caracteres" 
      };
    }
  }

  return { valid: true };
}

export default {
  VENEZUELAN_BANKS,
  DOCUMENT_TYPES,
  BANK_ACCOUNT_TYPES,
  PHONE_OPERATORS,
  getBankByCode,
  getBankByName,
  formatCedula,
  parseCedula,
  validateCedula,
  formatPhone,
  parsePhone,
  validatePhone,
};
