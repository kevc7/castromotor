import Link from "next/link";

export default function TerminosCondicionesPage() {
  return (
    <main className="min-h-screen bg-[#0f1725] text-white client-surface">
      {/* Navbar simple */}
      <nav className="sticky top-0 z-20 bg-[#0f1725]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-16">
          <Link href="/" className="text-sm font-medium text-slate-300 hover:text-white transition-colors tracking-wide">Inicio</Link>
          <div className="text-slate-300">Términos y Condiciones</div>
        </div>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-extrabold mb-6">Términos y Condiciones</h1>
        <div className="space-y-4 text-slate-200 leading-relaxed text-justify">
          <p><strong>1. Duración:</strong> El sorteo se realizará una vez se haya completado la venta total de números.</p>
          <p><strong>2. Elegibilidad:</strong> El sorteo está abierto a cualquier persona sin restricción de edad.</p>
          <p><strong>3. Selección del Ganador:</strong> El ganador será determinado en base a las últimas cifras del resultado de la lotería nacional.</p>
          <p><strong>4. Premio:</strong> El premio será entregado a nombre del ganador o su representante mayor de edad con todos los procesos de ley.</p>
          <p><strong>5. Notificación al Ganador:</strong> Nos pondremos en contacto con el ganador a través de los datos proporcionados al participar en el sorteo. Los resultados serán publicados en las redes y medios participantes.</p>
          <p><strong>6. Propiedad Intelectual:</strong> Todo el contenido proporcionado a través de este servicio está protegido por derechos de autor y otros derechos de propiedad intelectual.</p>
          <p><strong>7. Condiciones Generales:</strong> Deben venderse todos los números participantes para poder realizar el sorteo.</p>
          <p><strong>8. Premio:</strong> Los ganadores deben seguir nuestras redes sociales indicadas para el sorteo y demostrar que tienen el número ganador.</p>
          <p><strong>8.1 Premio mayor:</strong> El premio será entregado personalmente en la ciudad del ganador, se aplicarán restricciones. El ganador estará dispuesto y acepta ser grabado en video al momento de la entrega del premio.</p>
          <p><strong>8.2 Premios económicos o especiales:</strong> Serán entregados inmediatamente al ganador del número acertante vía transferencia, efectivo o a su vez físicamente de ser el caso, una vez sea verificado y corroborado por los técnicos.</p>
          <p><strong>8.2.1</strong> El ganador del premio especial deberá enviar un video mencionando a CastroMotor, en el debe mencionar el sorteo, el premio y enseñar el número con el que fue ganador.</p>
          <p><strong>8.2.2</strong> Si el premio económico es igual o mayor a $400 el ganador de dicho premio se comprometerá a comprar $100 en números del sorteo vigente por el cual fue acreedor al premio.</p>
          <p><strong>9. Asignación de números:</strong> Los números serán asignados por el sistema de manera única y aleatoria para cada participante.</p>
          <p><strong>10. Aceptación de Términos:</strong> La participación en el sorteo implica la aceptación de estos términos y condiciones.</p>
          <p><strong>11. Pagos con transferencia:</strong> El participante tendrá una hora solamente para realizar el pago y el envío de los datos de pago al número de WhatsApp de Proyectos Flores una vez realizado el pedido, de no hacerlo en ese tiempo su pedido no será procesado y no se permitirá por ningún término un reembolso.</p>
          <p><strong>12. Gastos de documentación:</strong> El ganador será el único responsable de cubrir los gastos asociados con la entrega del premio, notaría, impuestos, tarifas de traspaso, registro de propiedad y otros gastos no especificados en este documento relacionados con el premio.</p>
          <p><strong>13. Garantías:</strong> El organizador no es de ninguna manera responsable de ninguna garantía, representación o aval en relación con el premio después de su entrega, su calidad, condición mecánica o idoneidad para un propósito particular. No se otorgarán premios adicionales ni compensaciones de ningún tipo.</p>
          <p><strong>14. Limitación de Responsabilidad:</strong> El organizador no asume ninguna responsabilidad por cualquier dirección postal, dirección de correo electrónico o número de teléfono incorrectos o faltantes asociados con una participación, o cualquier cambio de dirección, correo electrónico o número de teléfono del participante después de la presentación de la participación. El organizador determinará cualquier detalle del premio no especificado a su entera discreción. El organizador no reemplazará ningún premio perdido, dañado o robado. Los premios se otorgan tal cual y sin garantía de ningún tipo, implícita o expresa.</p>
          <p><strong>15. Derecho de admisión:</strong> El organizador se reserva el derecho de admisión, y descalificar a cualquier persona que considere que está manipulando el proceso de participación o el funcionamiento del Sorteo o cualquier sitio web asociado y estar actuando en violación de las Reglas Oficiales.</p>
          <p><strong>16. Legislación Aplicable:</strong> Cada participante acepta que todas y cada una de las disputas, reclamaciones y causas de acción que surjan de, o estén relacionadas con el sorteo o cualquier premio otorgado se resolverán individualmente, sin recurrir a ninguna forma de demanda colectiva. En ninguna circunstancia se permitirá al participante obtener indemnizaciones por daños punitivos, incidentales o consecuentes, o cualquier otro daño, y renuncia a todos los derechos a reclamar daños y perjuicios, incluidos los honorarios de abogados, y el participante renuncia además a todos los derechos a que los daños se multiplican o aumenten. Este sorteo se regirá por las leyes de Ecuador. Cualquier disputa relacionada con este sorteo se resolverá ante los tribunales competentes de la ciudad de Machala.</p>
          <p><strong>17. Aceptación de las Condiciones:</strong> Al participar en este sorteo, los participantes aceptan de manera plena y sin reservas estos Términos y Condiciones. Los participantes también aceptan cualquier modificación que se pueda realizar a los mismos, siempre que esté debidamente publicada.</p>

          <div className="pt-4 border-t border-white/10 mt-6">
            <p className="text-slate-300 text-sm">
              <strong>Nota:</strong> Este sorteo no está patrocinado, respaldado ni administrado por Lotería Nacional, Facebook, Instagram, TikTok, correo directo, mensajes TXT u otras plataformas, y no están asociadas con ellas de ninguna manera. Los participantes proporcionan su información al patrocinador, no a estas plataformas, que no se hacen responsables de ninguna pérdida o daño relacionado con la participación o aceptación del premio. Además, las plataformas no tienen responsabilidad en la administración del sorteo ni en la entrega de premios. Al participar, los participantes aceptan las reglas del sorteo y el uso de su información solo para fines del evento, y para recibir actualizaciones y anuncios de la empresa, conforme a las leyes de privacidad aplicables.
            </p>
            <p className="mt-4 font-semibold">CastroMotor..</p>
            <p className="-mt-1">Haciendo realidad tus sueños..</p>
          </div>
          <div className="mt-8">
            <Link href="/" className="inline-block px-5 py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-sm">Volver al inicio</Link>
          </div>
        </div>
      </div>
      {/* Footer simple */}
      <footer className="bg-black/20 border-t border-white/10 py-6">
        <div className="max-w-6xl mx-auto px-6 text-sm text-slate-400">© 2025 Castromotor Sorteos</div>
      </footer>
    </main>
  );
}


