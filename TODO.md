# TODO

- [ ] Corregir error de Supabase en `AuthContext.jsx` quitando el join `empresas(nombre)` del query de `usuarios_app` y usando `.maybeSingle()`.
- [ ] Agregar logs más detallados del error (code/details) para facilitar debug.
- [ ] Ejecutar `npm run dev` / revisar consola para confirmar que ya no aparece el 406 ni `Cannot coerce the result to a single JSON object`.

