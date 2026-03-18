import { Loader2 } from "lucide-react";

const LoadingPage = () => {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Verificando sesión...</p>
      </div>
    </div>
  );
};

export default LoadingPage;
