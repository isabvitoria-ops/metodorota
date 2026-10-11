import { useEffect, useState } from "react";

export function AvisoOffline() {
  const [offline, definirOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const ficar = () => definirOffline(true);
    const voltar = () => definirOffline(false);
    window.addEventListener("offline", ficar);
    window.addEventListener("online", voltar);
    return () => {
      window.removeEventListener("offline", ficar);
      window.removeEventListener("online", voltar);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="c-aviso-offline" role="status">
      <span>Sem internet — usando dados salvos no aparelho</span>
    </div>
  );
}
