'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://castromotor.com.ec' 
  : 'http://localhost:3001';

export default function PayphoneSuccess() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verificando tu pago...');
  const [orderData, setOrderData] = useState<any>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        // Obtener parámetros de Payphone
        const id = searchParams.get('id');
        const clientTxId = searchParams.get('clientTxId');
        
        if (!id || !clientTxId) {
          throw new Error('Faltan parámetros de pago');
        }

        // Verificar el pago con nuestro backend
        const response = await fetch(`${API_BASE}/api/payphone/response?id=${id}&clientTxId=${clientTxId}`);
        const data = await response.json();

        if (response.ok && data.success) {
          setStatus('success');
          setMessage('¡Pago procesado exitosamente!');
          setOrderData(data.order);
        } else {
          throw new Error(data.error || 'Error verificando el pago');
        }
      } catch (error: any) {
        console.error('Error verificando pago:', error);
        setStatus('error');
        setMessage(error.message || 'Error verificando el pago');
      }
    };

    verifyPayment();
  }, [searchParams]);

  const handleContinue = () => {
    if (orderData?.sorteo_id) {
      router.push(`/sorteos/${orderData.sorteo_id}`);
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h1 className="text-xl font-semibold text-gray-800 mb-2">
                Verificando Pago
              </h1>
              <p className="text-gray-600">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-green-800 mb-2">
                ¡Pago Exitoso!
              </h1>
              <p className="text-gray-600 mb-4">{message}</p>
              
              {orderData && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
                  <h3 className="font-semibold text-gray-800 mb-2">Detalles de tu compra:</h3>
                  <p className="text-sm text-gray-600">
                    <strong>Orden:</strong> #{orderData.id}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Total:</strong> ${orderData.total}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Estado:</strong> <span className="text-green-600">Aprobado</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Recibirás un email de confirmación con todos los detalles.
                  </p>
                </div>
              )}

              <button
                onClick={handleContinue}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Continuar
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-red-800 mb-2">
                Error en el Pago
              </h1>
              <p className="text-gray-600 mb-4">{message}</p>
              <p className="text-sm text-gray-500 mb-4">
                Por favor, intenta nuevamente o contacta a soporte si el problema persiste.
              </p>
              
              <button
                onClick={handleContinue}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Volver al Sorteo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
