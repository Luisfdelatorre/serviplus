import React, { useState } from 'react';
import { sfx } from '../../utils/audio';
import './AttractScreen.css';

export function AttractScreen({ onStart }) {
  const [touchPos, setTouchPos] = useState(null);

  const handleStart = (e) => {
    if (e && e.clientX && e.clientY) {
      setTouchPos({ x: e.clientX, y: e.clientY });
    }
    sfx.playReadyChime();
    setTimeout(() => {
      onStart();
    }, 180);
  };

  return (
    <div className="attract-screen" onClick={handleStart}>
      {/* Patrones de fondo orgánicos y sutiles tipo Panera */}
      <svg
        className="attract-bg-svg"
        viewBox="0 0 1000 800"
        preserveAspectRatio="none"
      >
        <path
          d="M0,150 C300,50 400,300 700,100 C850,0 950,200 1000,120 L1000,0 L0,0 Z"
          fill="#375239"
        />
        <path
          d="M0,500 C200,420 350,600 650,450 C800,380 900,550 1000,480 L1000,800 L0,800 Z"
          fill="#375239"
        />
        <circle cx="820" cy="180" r="160" fill="#375239" opacity="0.4" />
      </svg>

      {/* Onda expansiva animada en la esquina superior derecha */}
      <div className="attract-ripple-container">
        <div className="attract-ripple-ring ring-1" />
        <div className="attract-ripple-ring ring-2" />
        <div className="attract-ripple-ring ring-3" />
      </div>

      {/* HEADER: Mensaje de bienvenida y Título TAP TO START */}
      <header className="attract-header">
        {/* Banner Pill de Marca */}
        <div className="attract-brand-pill">
          <span className="attract-brand-icon">🥙</span>
          <span className="attract-brand-text">Bienvenido a Kebab &amp; Shawarma</span>
        </div>

        {/* Headline Principal TAP TO START */}
        <h1 className="attract-headline">
          <span className="attract-headline-accent">Toca </span>
          <span>para empezar</span>
        </h1>

        <p className="attract-subtitle">
          Toca en cualquier parte para comenzar • Touch here to begin
        </p>
      </header>

      {/* ZONA CENTRAL: Showcase de dos deliciosos Kebabs / Wraps con Badges flotantes */}
      <div className="attract-showcase">
        {/* Producto 1: Kebab Tradicional */}
        <div className="attract-food-card food-left">
          {/* Badge Flotante Glassmorphism */}
          <div className="attract-food-badge badge-special">
            <div className="attract-badge-tag tag-special">
              ⭐ ¡ESPECIAL!
            </div>
            <div className="attract-badge-name">
              Kebab Tradicional
            </div>
          </div>

          <img
            src="/images/kebab.png"
            alt="Kebab Tradicional"
            className="attract-food-img img-kebab"
          />
        </div>

        {/* Producto 2: Shawarma Especial */}
        <div className="attract-food-card food-right">
          {/* Badge Flotante Glassmorphism */}
          <div className="attract-food-badge badge-popular">
            <div className="attract-badge-tag tag-popular">
              🔥 ¡POPULAR!
            </div>
            <div className="attract-badge-name">
              Shawarma Mixto
            </div>
          </div>

          <img
            src="/images/shawarma.png"
            alt="Shawarma Especial"
            className="attract-food-img img-shawarma"
          />
        </div>
      </div>

      {/* FOOTER: Botón llamativo e indicador interactivo de toque */}
      <footer className="attract-footer">
        <div className="attract-tap-button">
          <span className="attract-tap-icon">👉</span>
          <span>Toca aquí para ordenar</span>
        </div>
        <span className="attract-footer-caption">
          Sistema de Autoservicio Rápido y Seguro
        </span>
      </footer>
    </div>
  );
}
