
import { useState } from "react";
import SeguridadSec from "./seguridad/SeguridadSec";
import SeguridadDetalleSec from "./seguridad/SeguridadDetalleSec";


const SeguridadPage = () => {
  const [userId, setUserId] = useState<number | null>(null);

  return (
    <>
      {userId === null ? (
        <SeguridadSec setuser={setUserId} />
      ) : (
        <SeguridadDetalleSec setUserId={setUserId} userId={userId} />
      )}
    </>
  );
};

export default SeguridadPage;
