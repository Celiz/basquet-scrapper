'use client'

import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Calendar, Clock, MapPin } from 'lucide-react';

// TypeScript interfaces
interface BasketballRegistration {
  polideportivo: string;
  categoria: string;
  actividad: string;
  subcategoria: string;
  horario: string;
}

interface RegistrationData {
  timestamp: string;
  registrations: BasketballRegistration[];
}

export default function Dashboard() {
  const [data, setData] = useState<RegistrationData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/basketball-registrations');
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const result: RegistrationData = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load registration data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Set up auto-refresh every 30 minutes
    const intervalId = setInterval(() => fetchData(), 30 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-blue-600 text-white">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">Inscripciones de Básquet</h1>
          <p className="mt-2">Municipalidad de Mar del Plata</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-2 md:mb-0">
            Inscripciones Disponibles
          </h2>
          
          <div className="flex items-center space-x-4">
            {data?.timestamp && (
              <span className="text-sm text-gray-500 flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                Actualizado: {formatDate(data.timestamp)}
              </span>
            )}
            
            <button 
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="inline-flex items-center px-3 py-1 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Actualizar
            </button>
          </div>
        </div>

        {loading && !refreshing ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            <span className="ml-2 text-lg text-gray-600">Cargando inscripciones...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        ) : data?.registrations.length === 0 ? (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-md">
            No hay inscripciones de básquet disponibles en este momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data?.registrations.map((reg, index) => (
              <div key={index} className="bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow duration-300">
                <div className="bg-blue-600 text-white px-4 py-3">
                  <h3 className="font-medium text-lg">{reg.subcategoria}</h3>
                </div>
                
                <div className="p-4">
                  <div className="flex items-start mb-3">
                    <MapPin className="h-5 w-5 text-gray-500 mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">{reg.polideportivo}</p>
                      <p className="text-sm text-gray-500">{reg.categoria}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <Calendar className="h-5 w-5 text-gray-500 mr-2 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700">{reg.horario}</p>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <a 
                      href="#"
                      className="inline-block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Ver Detalles
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      </div>
  );
}