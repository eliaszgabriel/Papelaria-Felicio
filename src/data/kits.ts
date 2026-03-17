export type HomeKit = {
  id: string;
  title: string;
  subtitle: string;
  price: number;
  tag?: string;
};

export const kits: HomeKit[] = [
  {
    id: "kit-escolar-criativo",
    title: "Kit Escolar Criativo",
    subtitle: "Itens essenciais para volta as aulas com um toque fofo.",
    price: 79.9,
    tag: "Escolar",
  },
  {
    id: "kit-presente-delicado",
    title: "Kit Presente Delicado",
    subtitle: "Selecao pronta para presentear com carinho.",
    price: 89.9,
    tag: "Presente",
  },
  {
    id: "kit-papelaria-colorida",
    title: "Kit Papelaria Colorida",
    subtitle: "Bloco, canetas e acessorios para organizar a rotina.",
    price: 69.9,
    tag: "Organizacao",
  },
  {
    id: "kit-estudo-foco",
    title: "Kit Estudo Foco",
    subtitle: "Combinacao pensada para estudo e anotacoes do dia a dia.",
    price: 74.9,
    tag: "Estudo",
  },
];
