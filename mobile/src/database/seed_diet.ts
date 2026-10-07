export interface StaticMeal {
  id: number;
  name: string;
  timeEstimate: string;
  options: {
    title: string;
    description: string;
  }[];
}

export const SARAIVA_DIET_PLAN: {
  calories: number;
  waterGoalMl: number;
  meals: StaticMeal[];
} = {
  calories: 2236,
  waterGoalMl: 3500, // Meta 3.5 Litros
  meals: [
    {
      id: 1,
      name: 'Refeição 1 - Café da Manhã',
      timeEstimate: '07:30 - 08:30',
      options: [
        {
          title: 'Opção Padrão (Ovos + Pão)',
          description: '4 ovos inteiros mexidos ou cozidos + 2 fatias de pão integral (50g) + 1 fruta (maçã/banana) + café preto sem açúcar',
        },
        {
          title: 'Opção Shake Proteico',
          description: '40g Whey Protein + 60g aveia em flocos + 1 banana + 200ml água ou leite desnatado',
        },
      ],
    },
    {
      id: 2,
      name: 'Refeição 2 - Almoço',
      timeEstimate: '12:00 - 13:00',
      options: [
        {
          title: 'Opção Arroz + Frango',
          description: '180g de arroz branco pesado cozido + 160g de peito de frango grelhado + salada verde à vontade + 5ml azeite de oliva',
        },
        {
          title: 'Opção Batata + Patinho',
          description: '250g de batata inglesa cozida + 150g de patinho moído grelhado + salada verde à vontade',
        },
      ],
    },
    {
      id: 3,
      name: 'Refeição 3 - Lanche da Tarde (Pré-Treino)',
      timeEstimate: '15:30 - 16:30',
      options: [
        {
          title: 'Opção Mingau / Aveia',
          description: '50g aveia + 30g Whey Protein + 1 maçã picada com canela',
        },
        {
          title: 'Opção Sanduíche Proteico',
          description: '2 fatias de pão integral + 120g peito de frango desfiado ou atum sólido',
        },
      ],
    },
    {
      id: 4,
      name: 'Refeição 4 - Pós-Treino',
      timeEstimate: '18:30 - 19:30',
      options: [
        {
          title: 'Opção Rápida Pós-Treino',
          description: '40g Whey Protein + 1 banana média (ou 30g de doce de leite)',
        },
      ],
    },
    {
      id: 5,
      name: 'Refeição 5 - Jantar',
      timeEstimate: '20:30 - 21:30',
      options: [
        {
          title: 'Opção Padrão',
          description: '180g arroz branco cozido + 160g peito de frango ou peixe branco grelhado + legumes grelhados',
        },
        {
          title: 'Opção Carne Vermelha Magra',
          description: '200g mandioca cozida + 150g patinho grelhado + salada à vontade',
        },
      ],
    },
    {
      id: 6,
      name: 'Refeição 6 - Ceia',
      timeEstimate: '22:30 - 23:00',
      options: [
        {
          title: 'Opção Ovos ou Iogurte',
          description: '3 ovos cozidos OU 170g iogurte grego natural desnatado com 15g castanhas',
        },
      ],
    },
  ],
};

export const SARAIVA_PROTOCOL_ITEMS = [
  {
    id: 'supp_d3',
    name: 'Vitamina D3',
    dosage: '10.000 UI',
    frequency: 'Diário (manhã)',
    type: 'SUPPLEMENT',
  },
  {
    id: 'supp_mg',
    name: 'Magnésio Quelato',
    dosage: '400mg',
    frequency: 'Diário (noite)',
    type: 'SUPPLEMENT',
  },
  {
    id: 'supp_nac',
    name: 'NAC (N-Acetilcisteína)',
    dosage: '600mg',
    frequency: 'Diário (em jejum ou almoço)',
    type: 'SUPPLEMENT',
  },
  {
    id: 'med_telmisartana',
    name: 'Telmisartana',
    dosage: '40mg',
    frequency: 'Diário (manhã)',
    type: 'MEDICATION',
  },
  {
    id: 'med_tadala',
    name: 'Tadalafila',
    dosage: '5mg',
    frequency: 'Diário (pré-treino)',
    type: 'MEDICATION',
  },
  {
    id: 'horm_testo',
    name: 'Enantato de Testosterona',
    dosage: '150mg (0.6ml - 300mg/sem total)',
    frequency: 'Segunda-feira & Quinta-feira',
    type: 'HORMONAL',
  },
];
