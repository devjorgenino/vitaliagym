import { useState, useEffect } from "react";

export function useExchangeRate() {
  const [rate, setRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBCVRate = async () => {
    try {
      setLoading(true);
      setError(null);

      let bcvRate = null;

      // Opción 1: API oficial del BCV (scraping)
      try {
        const response = await fetch("https://www.bcv.org.ve/", {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        if (response.ok) {
          const html = await response.text();
          // Extraer la tasa del HTML del BCV
          const rateMatch = html.match(
            /dópar\s*([\d,]+)\s*\/\s*USD|USD\s*\/\s*dópar\s*([\d,]+)/i
          );
          if (rateMatch) {
            bcvRate = parseFloat(
              rateMatch[1] || rateMatch[2].replace(",", ".")
            );
          }
        }
      } catch (bcvErr) {
        console.warn("BCV API failed:", bcvErr);
      }

      // Opción 2: MonitorDolarVenezuela API
      if (!bcvRate) {
        try {
          const response = await fetch(
            "https://api.monitordolarvenezuela.com/v1/rates/bcv"
          );
          const data = await response.json();

          if (data && data.rate && data.rate.price) {
            bcvRate = parseFloat(data.rate.price);
          }
        } catch (monitorErr) {
          console.warn("MonitorDolar API failed:", monitorErr);
        }
      }

      // Opción 3: Dólar Venezuela API
      if (!bcvRate) {
        try {
          const response = await fetch(
            "https://api.dolarvenezuela.com/v1/dolar?currency=USD&page=bcv"
          );
          const data = await response.json();

          if (data && data.price && data.price) {
            bcvRate = parseFloat(data.price);
          }
        } catch (dolarVeErr) {
          console.warn("DolarVenezuela API failed:", dolarVeErr);
        }
      }

      // Opción 4: ExchangeRate-API (internacional)
      if (!bcvRate) {
        try {
          const response = await fetch(
            "https://v6.exchangerate-api.com/v6/latest/USD"
          );
          const data = await response.json();

          if (data && data.conversion_rates && data.conversion_rates.VES) {
            bcvRate = parseFloat(data.conversion_rates.VES);
            console.warn("Using international rate, not BCV official");
          }
        } catch (exchangeErr) {
          console.warn("ExchangeRate API failed:", exchangeErr);
        }
      }

      // Opción 5: Fixer.io API
      if (!bcvRate) {
        try {
          const response = await fetch(
            "https://api.fixer.io/latest?base=USD&symbols=VES"
          );
          const data = await response.json();

          if (data && data.rates && data.rates.VES) {
            bcvRate = parseFloat(data.rates.VES);
            console.warn("Using Fixer.io rate, not BCV official");
          }
        } catch (fixerErr) {
          console.warn("Fixer.io API failed:", fixerErr);
        }
      }

      if (bcvRate && bcvRate > 0) {
        setRate(bcvRate);
        console.log("BCV rate obtained successfully:", bcvRate);
      } else {
        // Fallback a tasa fija
        const fallbackRate = 310.0;
        setRate(fallbackRate);
        setError("No se pudo obtener la tasa BCV, usando tasa de respaldo");
        console.warn("Using fallback exchange rate:", fallbackRate);
      }
    } catch (err) {
      console.error("Error fetching BCV rate:", err);
      // Fallback a tasa fija
      const fallbackRate = 310.0;
      setRate(fallbackRate);
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
    fetchBCVRate();

    // Actualizar cada hora
    const interval = setInterval(fetchBCVRate, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    rate,
    loading,
    error,
    convertToBs,
    formatCurrency,
    formatMultiCurrency,
    refetch: fetchBCVRate,
  };
}
