-- El NULL temporal distingue filas anteriores de decisiones ya tomadas.
-- Repetir esta migracion no vuelve a aprobar cuentas revocadas.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS aprobado boolean;
UPDATE usuarios SET aprobado = (rol = 'admin' AND activo) WHERE aprobado IS NULL;
ALTER TABLE usuarios ALTER COLUMN aprobado SET DEFAULT false;
ALTER TABLE usuarios ALTER COLUMN aprobado SET NOT NULL;
