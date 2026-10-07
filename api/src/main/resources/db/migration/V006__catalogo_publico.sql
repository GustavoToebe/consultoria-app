-- Catálogo público (seções 13.4 e 13.5 do plano). UUIDs fixos derivados do nome, iguais em todo banco.
-- Os alimentos são valores de demonstração; a base oficial (TACO/IBGE) entra depois, com licença verificada.

insert into catalogo_exercicio (id, nome, grupo_muscular, equipamento, modalidade)
select md5('catalogo-exercicio:' || v.nome)::uuid, v.nome, v.grupo, v.equipamento, v.modalidade
from (values
  ('Supino reto com barra', 'Peito', 'Barra', 'LIVRE'),
  ('Supino inclinado com halteres', 'Peito', 'Halteres', 'LIVRE'),
  ('Supino reto na máquina', 'Peito', 'Máquina', 'MAQUINA'),
  ('Crucifixo na máquina (peck deck)', 'Peito', 'Máquina', 'MAQUINA'),
  ('Crossover na polia', 'Peito', 'Polia', 'MAQUINA'),
  ('Flexão de braço', 'Peito', 'Peso corporal', 'PESO_CORPORAL'),
  ('Puxada alta na polia', 'Costas', 'Polia', 'MAQUINA'),
  ('Remada curvada com barra', 'Costas', 'Barra', 'LIVRE'),
  ('Remada baixa na polia', 'Costas', 'Polia', 'MAQUINA'),
  ('Remada unilateral com halter', 'Costas', 'Halteres', 'LIVRE'),
  ('Remada na máquina articulada', 'Costas', 'Máquina', 'MAQUINA'),
  ('Barra fixa', 'Costas', 'Peso corporal', 'PESO_CORPORAL'),
  ('Pulldown com corda', 'Costas', 'Polia', 'MAQUINA'),
  ('Desenvolvimento com halteres', 'Ombros', 'Halteres', 'LIVRE'),
  ('Desenvolvimento na máquina', 'Ombros', 'Máquina', 'MAQUINA'),
  ('Elevação lateral com halteres', 'Ombros', 'Halteres', 'LIVRE'),
  ('Elevação lateral na máquina', 'Ombros', 'Máquina', 'MAQUINA'),
  ('Crucifixo inverso na máquina', 'Ombros', 'Máquina', 'MAQUINA'),
  ('Face pull na polia', 'Ombros', 'Polia', 'MAQUINA'),
  ('Rosca direta com barra', 'Bíceps', 'Barra', 'LIVRE'),
  ('Rosca alternada com halteres', 'Bíceps', 'Halteres', 'LIVRE'),
  ('Rosca martelo', 'Bíceps', 'Halteres', 'LIVRE'),
  ('Rosca na polia', 'Bíceps', 'Polia', 'MAQUINA'),
  ('Tríceps na polia com corda', 'Tríceps', 'Polia', 'MAQUINA'),
  ('Tríceps na polia com barra', 'Tríceps', 'Polia', 'MAQUINA'),
  ('Tríceps francês com halter', 'Tríceps', 'Halteres', 'LIVRE'),
  ('Mergulho nas paralelas', 'Tríceps', 'Peso corporal', 'PESO_CORPORAL'),
  ('Agachamento livre', 'Pernas', 'Barra', 'LIVRE'),
  ('Agachamento no smith', 'Pernas', 'Smith', 'MAQUINA'),
  ('Leg press 45º', 'Pernas', 'Máquina', 'MAQUINA'),
  ('Leg press horizontal', 'Pernas', 'Máquina', 'MAQUINA'),
  ('Hack machine', 'Pernas', 'Máquina', 'MAQUINA'),
  ('Cadeira extensora', 'Quadríceps', 'Máquina', 'MAQUINA'),
  ('Cadeira flexora', 'Posterior', 'Máquina', 'MAQUINA'),
  ('Mesa flexora', 'Posterior', 'Máquina', 'MAQUINA'),
  ('Stiff com barra', 'Posterior', 'Barra', 'LIVRE'),
  ('Levantamento terra', 'Posterior', 'Barra', 'LIVRE'),
  ('Elevação pélvica', 'Glúteos', 'Barra/Máquina', 'MAQUINA'),
  ('Abdução de quadril na máquina', 'Glúteos', 'Máquina', 'MAQUINA'),
  ('Abdução de quadril na polia', 'Glúteos', 'Polia', 'MAQUINA'),
  ('Afundo com halteres', 'Pernas', 'Halteres', 'LIVRE'),
  ('Búlgaro com halteres', 'Pernas', 'Halteres', 'LIVRE'),
  ('Panturrilha em pé na máquina', 'Panturrilha', 'Máquina', 'MAQUINA'),
  ('Panturrilha sentado', 'Panturrilha', 'Máquina', 'MAQUINA'),
  ('Abdominal supra na máquina', 'Abdômen', 'Máquina', 'MAQUINA'),
  ('Abdominal na polia alta com corda', 'Abdômen', 'Polia', 'MAQUINA'),
  ('Prancha', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL'),
  ('Elevação de pernas', 'Abdômen', 'Peso corporal', 'PESO_CORPORAL'),
  ('Esteira', 'Cardio', 'Esteira', 'CARDIO'),
  ('Bicicleta ergométrica', 'Cardio', 'Bicicleta', 'CARDIO'),
  ('Elíptico', 'Cardio', 'Elíptico', 'CARDIO'),
  ('Clamshell com elástico', 'Glúteos', 'Elástico', 'ELASTICO')
) as v(nome, grupo, equipamento, modalidade);

insert into catalogo_alimento (id, nome, base_quantidade, base_unidade, kcal, proteina, carboidrato, gordura, fonte)
select md5('catalogo-alimento:' || v.nome)::uuid, v.nome, 100, 'g', v.kcal, v.proteina, v.carboidrato, v.gordura,
       'Valores de demonstração (plano de exemplo). Não usar como referência nutricional.'
from (values
  ('Pão de forma branco', 266, 8.4, 49.6, 3.2),
  ('Semente de chia', 500, 16, 42, 30),
  ('Frutas (mamão, abacaxi, melão, morango, maçã ou kiwi)', 40, 0.53, 10, 0),
  ('Iogurte desnatado', 36, 3.53, 5, 0.13),
  ('Aveia em flocos', 393.3, 14, 66.67, 8.33),
  ('Banana prata', 98, 1.3, 25.7, 0.1),
  ('Arroz branco cozido', 127.8, 2.5, 28.1, 0.22),
  ('Peito de frango grelhado', 159, 32, 0, 2.7),
  ('Batata inglesa cozida', 80, 1.2, 20, 0.12)
) as v(nome, kcal, proteina, carboidrato, gordura);
