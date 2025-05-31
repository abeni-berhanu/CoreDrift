import React, { useState, useEffect } from "react";
import { getSymbols } from "../services/SymbolService";

const SymbolSettings = () => {
  const [symbols, setSymbols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadSymbols = async () => {
      try {
        setLoading(true);
        const data = await getSymbols();
        setSymbols(data);
        setError(null);
      } catch (err) {
        setError("Failed to load symbols");
        console.error("Error loading symbols:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSymbols();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Available Symbols</h3>
          {error ? (
            <p className="text-red-500">{error}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Symbol
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pip Size
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pip Value Per Lot
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {symbols.map((symbol) => (
                    <tr
                      key={symbol.id}
                      className="border-b border-gray-200 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {symbol.id}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {symbol.pipSize}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {symbol.pipValuePerLot}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SymbolSettings;
