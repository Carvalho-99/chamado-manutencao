-- Troca o hash guardado: PBKDF2 -> SHA256(PBKDF2).
-- O navegador segue calculando o PBKDF2; o servidor confere o SHA-256.

UPDATE usuarios SET senha_hash = 'd2b6f2d965f7de958e9ae3376bb6d8893fa732acae1009a48065b145136bb62d' WHERE nome = 'FERNANDO BETIM';
UPDATE usuarios SET senha_hash = 'fc6fdb05dc2013bb915de9914f46d86fb961f8c88b08b44fceba30e138ae4878' WHERE nome = 'SAMUEL LIMA';
UPDATE usuarios SET senha_hash = 'dcfbb4d946c552896795dc05c1d8e80502d6c51a78162820313cd41e0cbb0094' WHERE nome = 'JOVENIL SILVA';
UPDATE usuarios SET senha_hash = '9a2207e5ccf5c5363b5f5a442854f3588fa849b2aa32d4201ee3f72b405321c6' WHERE nome = 'ARGEU CARVALHO';
UPDATE usuarios SET senha_hash = '09f92acba6d71def20bf0e23a14d99efdd5b2960fe5971d1148380356d49845a' WHERE nome = 'PAULO CUNHA';
UPDATE usuarios SET senha_hash = '019720dadf48a300033730f6b963d658e9d782ae05244bd47f47e4a5f9b326f4' WHERE nome = 'PAULO HENRIQUE';
UPDATE usuarios SET senha_hash = '2de8a3293995d99fad3fb0f5a4ad0df960d19cf2ee18800b50be81c4d5b55cf5' WHERE nome = 'ANTONIO SANTOS';
UPDATE usuarios SET senha_hash = '481d6186ea08c377a0ba39987d6dd67002356a6dff2cc73b4caaa4a50e1bf76e' WHERE nome = 'MARCIO ALMEIDA';
UPDATE usuarios SET senha_hash = 'a0bd4858999c66dddd72742ff1767254707278cd2bac74e231a8a299d80b9ab9' WHERE nome = 'AMARILDO SILVA';
UPDATE usuarios SET senha_hash = '3fb4812c4a62a98be56520bfde7a94911cc215df5b1d509a5e2d641b77fc53fe' WHERE nome = 'CLEYTON MOREIRA';
UPDATE usuarios SET senha_hash = '384c7b1ece3adb183aba6ea66f8ce57e1217608591c963b3aee4c3cfd666f7a3' WHERE nome = 'VITTOR LODONHO';
UPDATE usuarios SET senha_hash = '65e3d6b16fead67887395e46472a66117151e9f021718ca05944ba48db0f814a' WHERE nome = 'VINICIUS SANTOS';
UPDATE usuarios SET senha_hash = '28a351c610f48407b6b9127fa6a5080bfd5f41efe58081cf4068d1a840731cc6' WHERE nome = 'EVERSON SANTOS';
UPDATE usuarios SET senha_hash = '9f5ac9fd511cad43c4b565b34f4e92fc74a9191adb4cf77de2cf7bd46d78dfab' WHERE nome = 'ALESSANDRO RODRIGUES';
UPDATE usuarios SET senha_hash = 'c9d2530e438c895f2c93ca06a1ff0c53b7a155e55956bc2da09547e08a9403c4' WHERE nome = 'MATHEUS OLIVEIRA';
UPDATE usuarios SET senha_hash = '9311d45383f036e259277d97778cfb8701dd7efe109dbd2f246bb68029bccedf' WHERE nome = 'JOSUEL OLIVEIRA';
