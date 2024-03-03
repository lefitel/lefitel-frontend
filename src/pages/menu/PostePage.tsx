import { useState } from "react";
import PosteSec from "./poste/PosteSec.";
import PosteDetalleSec from "./poste/PosteDetalleSec";


const PostePage = () => {
  const [posteId, setposteId] = useState<number | null>(null);

  return (
    <>
      {posteId === null ? (
        <PosteSec setposte={setposteId} />
      ) : (
        <PosteDetalleSec posteId={posteId} setPosteId={setposteId} />
      )}
    </>
  );
};

export default PostePage;
