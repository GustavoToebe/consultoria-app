-- Duas fontes novas para o nome da consultoria (Esportiva e Condensada).
alter table consultoria drop constraint consultoria_fonte_titulo_check;
alter table consultoria add constraint consultoria_fonte_titulo_check check (fonte_titulo in
 ('PADRAO','METAL','ESPORTIVA','CONDENSADA'));
