import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import RegistrarAlumno from './pages/RegistrarAlumno';
import CobrarCuota from './pages/CobrarCuota';
import Recordatorios from './pages/Recordatorios';
import Configuracion from './pages/Configuracion';
import Login from './pages/Login';
import Registro from './pages/Registro';
import VerificarEmail from './pages/VerificarEmail';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';

export default function App() {
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    // Marcar como cargado después de verificar el estado inicial
    setLoading(false);
  }, [setLoading]);

  return (
    <HashRouter>
      <Routes>
        {/* Rutas públicas de autenticación */}
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/verificar" element={<VerificarEmail />} />
        
        {/* Rutas protegidas del panel */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="registrar" element={<RegistrarAlumno />} />
          <Route path="cobrar" element={<CobrarCuota />} />
          <Route path="recordatorios" element={<Recordatorios />} />
          <Route path="configuracion" element={<Configuracion />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
