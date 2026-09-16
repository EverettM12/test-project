import './styling/App.css';
import Auth from './Auth.tsx';
/* import { useState, useEffect } from 'react'; */
import { supabase } from './utils/supabase.ts';

function App() {
  return (
    <>
      <Auth />
    </>
  );
}

export default App;
