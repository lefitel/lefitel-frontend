import { useState, useEffect } from 'react';

const LoadingPage = () => {
    const [dots, setDots] = useState('');

    useEffect(() => {
        const interval = setInterval(() => {
            setDots((prevDots) => {
                if (prevDots.length >= 3) {
                    return '';
                } else {
                    return prevDots + '.';
                }
            });
        }, 500); // Cambia el tiempo aquí para ajustar la velocidad de los puntos

        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{ textAlign: 'center', marginTop: '20vh', fontSize: '24px' }}>
            <p>Cargando{dots}</p>
        </div>
    );
};

export default LoadingPage;