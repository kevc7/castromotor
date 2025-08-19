'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function PayphoneError() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Obtener información del error desde los parámetros de URL
    const error = searchParams.get('error');
    const message = searchParams.get('message');
    const id = searchParams.get('id');
    
    if (error) {
      setErrorMessage(decodeURIComponent(error));
    } else if (message) {
      setErrorMessage(decodeURIComponent(message));
    } else {
      setErrorMessage('El pago fue cancelado o no pudo completarse.');
    }

    // Log para debugging
    console.log('Payphone Error Page - Parámetros:', {
      error,
      message,
      id,
      allParams: Object.fromEntries(searchParams.entries())
    });
  }, [searchParams]);

  const handleRetry = () => {
    const sorteoId = searchParams.get('sorteoId');
    if (sorteoId) {
      router.push(`/sorteos/${sorteoId}`);
    } else {
      router.push('/');
    }
  };

  const handleGoHome = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          
          <h1 className="text-xl font-semibold text-red-800 mb-2">
            Pago No Completado
          </h1>
          
          <p className="text-gray-600 mb-4">
            {errorMessage || 'No se pudo procesar tu pago con Payphone.'}
          </p>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Qué hacer ahora:
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Verifica que tengas fondos suficientes</li>
                    <li>Asegúrate de tener una conexión estable</li>
                    <li>Intenta con otra tarjeta si es necesario</li>
                    <li>Contacta a soporte si el problema persiste</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Intentar Nuevamente
            </button>
            
            <button
              onClick={handleGoHome}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Ir al Inicio
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Si continúas teniendo problemas, puedes contactarnos en:{' '}
              <a href="mailto:soporte@castromotor.com.ec" className="text-blue-600 hover:underline">
                soporte@castromotor.com.ec
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
