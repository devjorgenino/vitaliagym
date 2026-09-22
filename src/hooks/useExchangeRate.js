import { useState, useEffect } from "react";

// Tasa de respaldo usada únicamente cuando no se puede obtener la tasa BCV
// (sin conexión, sin caché y sin fuente externa). Se expone como constante
// nombrada para que sea configurable y auditable; no es un valor mágico.
export const FALLBACK_EXCHANGE_RATE = 310.0;

export function useExchangeRate() {
  const [rate, setRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isManualRate, setIsManualRate] = useState(false);
  // True cuando la tasa actual es la de respaldo, no una real del BCV.
  // Permite a la UI advertir al usuario en lugar de mostrársela sin contexto.
  const [isFallback, setIsFallback] = useState(false);

  const setManualRate = (newRate) => {
    if (newRate && newRate > 0) {
      setRate(newRate);
      setIsManualRate(true);
      setError(null);
      setIsFallback(false);
      localStorage.setItem('manualExchangeRate', newRate.toString());
      localStorage.setItem('isManualRate', 'true');
    }
  };

  const resetToAutomatic = () => {
    setIsManualRate(false);
    localStorage.removeItem('manualExchangeRate');
    localStorage.removeItem('isManualRate');
    fetchBCVRate();
  };

  const fetchBCVRate = async () => {
    try {
      setLoading(true);
      setError(null);

      // Helper function that attempts to fetch from multiple sources
      const fetchFromSources = async () => {
          let bcvRate = null;
          let fetchError = null;

          // Opción 1: Ve.dolarapi.com (API gratuita y estable)
          try {
            const response = await fetch(
              "https://ve.dolarapi.com/v1/dolares/oficial"
            );
            if (response.ok) {
              const data = await response.json();
              if (data && data.promedio) {
                bcvRate = parseFloat(data.promedio);
              }
            }
          } catch (dolarApiErr) {
            fetchError = dolarApiErr;
          }

          // Opción 2: DolarToday API
          if (!bcvRate) {
            try {
              const response = await fetch(
                "https://s3.amazonaws.com/dolartoday/data.json"
              );
              if (response.ok) {
                const data = await response.json();
                if (data && data.USD && data.USD.sicad2) {
                  bcvRate = parseFloat(data.USD.sicad2);
                }
              }
            } catch (dolarTodayErr) {
              // Silently fail to next source
            }
          }

          if (bcvRate && bcvRate > 0) {
              return { data: bcvRate, error: null };
          }
          
          return { data: null, error: fetchError || new Error("No se pudo obtener la tasa de ninguna fuente") };
      };

      // Wrap with offline fetcher
      // We import fetchWithOffline dynamically or assume it's available in scope if I import it up top. 
      // I need to add import up top.
      const { fetchWithOffline } = await import('../lib/offline-read');
      
      const { data: cachedRate, error: fetchError } = await fetchWithOffline('exchange-rate-bcv', fetchFromSources);

      if (cachedRate && cachedRate > 0) {
        setRate(cachedRate);
        setIsFallback(false);
      } else {
        // Fallback a tasa fija si todo falla (incluso caché)
        const fallbackRate = FALLBACK_EXCHANGE_RATE;
        setRate(fallbackRate);
        setIsFallback(true);
        setError("No se pudo obtener la tasa BCV (ni online ni caché), usando tasa de respaldo");
      }
    } catch (err) {
      // Fallback a tasa fija
      const fallbackRate = FALLBACK_EXCHANGE_RATE;
      setRate(fallbackRate);
      setIsFallback(true);
      setError(
        "No se pudo obtener la tasa BCV, usando tasa de respaldo: " +
          err.message
      );
    } finally {
      setLoading(false);
    }
  };

  const convertToBs = (usdAmount) => {
    if (!rate || !usdAmount) return 0;
    return usdAmount * rate;
  };

  const formatCurrency = (amount, currency = "USD") => {
    const formatted = new Intl.NumberFormat("es-VE", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "VES",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

    return formatted;
  };

  const formatMultiCurrency = (usdAmount) => {
    if (!rate) {
      return {
        usd: formatCurrency(usdAmount, "USD"),
        bs: "Cargando...",
        rate: null,
      };
    }

    const bsAmount = convertToBs(usdAmount);

    return {
      usd: formatCurrency(usdAmount, "USD"),
      bs: formatCurrency(bsAmount, "VES"),
      rate: rate,
    };
  };

  useEffect(() => {
    // Verificar si hay una tasa manual guardada
    const savedManualRate = localStorage.getItem('manualExchangeRate');
    const savedIsManual = localStorage.getItem('isManualRate');
    
    if (savedIsManual === 'true' && savedManualRate) {
      const manualRate = parseFloat(savedManualRate);
      setRate(manualRate);
      setIsManualRate(true);
      setLoading(false);
      console.log("Using saved manual exchange rate:", manualRate);
    } else {
      fetchBCVRate();
      // Actualizar cada hora solo si no es tasa manual
      const interval = setInterval(fetchBCVRate, 60 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, []);

  return {
    rate,
    loading,
    error,
    isManualRate,
    isFallback,
    convertToBs,
    formatCurrency,
    formatMultiCurrency,
    setManualRate,
    resetToAutomatic,
    refetch: fetchBCVRate,
  };
}
