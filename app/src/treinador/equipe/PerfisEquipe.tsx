import { useState } from 'react';
import { View } from 'react-native';
import * as api from '../../api/rotas';
import type { PerfilEquipe, PermissaoEquipe } from '../../api/equipeTipos';
import { colunasPorCelula } from '../../dominio/colunasPorCelula';
import { motivoSemEditarPerfil, podeDuplicarPerfil, podeEditarPerfil } from '../../dominio/perfilEquipe';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { MensagemErro } from '../../ui/Estados';
import { Grade } from '../../ui/Grade';
import { textoDoErro } from '../../ui/erros';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { NoPlano } from '../../ui/NoPlano';
import { Permitido } from '../../ui/Permitido';
import { Selo } from '../../ui/Selo';
import { useFaixaDaTela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { EditorDePerfil } from './EditorDePerfil';
import { useAtorEquipe } from './useAtorEquipe';

/**
 * Descrição dos quatro perfis que toda consultoria ganha ao nascer (a API os cria sem descrição). Vale só enquanto o
 * perfil não tem descrição própria; mudou as permissões, escreva a descrição no editor.
 */
/**
 * Tela larga (revisão de 24/11): da faixa larga em diante a grade ocupa a largura toda do conteúdo (sem teto, na borda das
 * abas), com células de pelo menos 360 px e linhas equilibradas (`ultimaLinha="esticar"`: 6 perfis em 4 colunas = 3 + 3;
 * os 4 padrão numa linha a partir de ~1500 px de grade). Abaixo da faixa larga, a regra de antes: células de 560 px (um por
 * linha em 1280).
 */
const CELULA_DO_PERFIL = 560;
const CELULA_DO_PERFIL_LARGA = 360;

const DESCRICOES_PADRAO: Record<string, string> = {
  Administrador: 'Acesso total: equipe, marca, conta e auditoria, além de tudo dos alunos.',
  Treinador: 'Alunos, treinos, dietas, atualizações, anamneses e interessados.',
  Nutricionista: 'Dietas, atualizações e anamneses; só lê alunos e treinos.',
  Assistente: 'Cadastra e convida alunos e atende interessados; só lê os planos.',
};

export function PerfisEquipe({perfis,catalogo,recarregar}:{perfis:PerfilEquipe[];catalogo:PermissaoEquipe[];recarregar:()=>void}) {
  const [editar,setEditar]=useState<PerfilEquipe|'novo'|null>(null);
  const [excluir,setExcluir]=useState<PerfilEquipe|null>(null);
  const [ocupado,setOcupado]=useState(false);const [erro,setErro]=useState<unknown>(null);const {avisar}=useAviso();
  const ator=useAtorEquipe();
  const {temFuncionalidade,pode}=useSessao();
  const faixa=useFaixaDaTela();const larga=faixa==='larga'||faixa==='ultralarga';
  const colunas=(largura:number)=>colunasPorCelula(largura,larga?CELULA_DO_PERFIL_LARGA:CELULA_DO_PERFIL,espaco(2),larga?Math.max(1,perfis.length):4);
  // Equipe fora do plano: perfis só para consulta, edição e exclusão; sem criar nem duplicar.
  const criaLiberado=temFuncionalidade('EQUIPE');
  const duplicar=async(p:PerfilEquipe)=>{setErro(null);try{await api.duplicarPerfilEquipe(p.id);recarregar();avisar('Perfil duplicado.','sucesso');}catch(e){setErro(e);}};
  const apagar=async()=>{if(!excluir)return;setOcupado(true);setErro(null);try{await api.excluirPerfilEquipe(excluir.id);setExcluir(null);recarregar();avisar('Perfil excluído.','sucesso');}catch(e){setExcluir(null);setErro(e);}finally{setOcupado(false);}};
  return <>
    <Cartao titulo="Perfis de acesso" descricao="Cada perfil define o que a pessoa vê e altera." acoes={<NoPlano funcionalidade="EQUIPE"><Permitido codigo="PERFIL_ALTERAR"><Botao rotulo="Novo perfil" aoTocar={()=>setEditar('novo')}/></Permitido></NoPlano>}>
    {erro?<MensagemErro texto={textoDoErro(erro)}/>:null}
    <Grade gap={espaco(2)} colunas={colunas} ultimaLinha={larga?'esticar':'igual'}>
    {/* Na tela larga os botões vão no `rodape` do cartão: com os cartões da linha esticados à mesma altura, ficam todos na
        mesma base (sem PERFIL_ALTERAR não há rodapé, nem o recuo vazio dele). Abaixo da faixa larga, no corpo, como antes. */}
    {perfis.map(p=>{
      const botoes=<View style={{flexDirection:'row',gap:espaco(1),flexWrap:'wrap',alignItems:'center'}}>
        {/* Rótulo curto na tela (o nome já é o título do cartão); o leitor de tela ouve o nome junto. Sem "Editar", o
            motivo em texto no lugar (nada de botão apagado sem explicação). */}
        {podeEditarPerfil(ator,p)?<Botao rotulo="Editar" rotuloAcessivel={`Editar ${p.nome}`} tipo="secundario" aoTocar={()=>setEditar(p)}/>
          :<Texto variante="pequeno" style={{flexBasis:'100%'}}>{motivoSemEditarPerfil(ator,p)}</Texto>}
        {criaLiberado&&podeDuplicarPerfil(ator,p)?<Botao rotulo="Duplicar" rotuloAcessivel={`Duplicar ${p.nome}`} tipo="secundario" aoTocar={()=>void duplicar(p)}/>:null}
        {!p.sistema?<Botao rotulo="Excluir" rotuloAcessivel={`Excluir ${p.nome}`} tipo="perigoTexto" aoTocar={()=>setExcluir(p)}/>:null}
      </View>;
      return <Cartao key={p.id} titulo={p.nome} style={{flexGrow:1}} acoes={<>
        {p.acessoTotal?<Selo texto="Acesso total · perfil do sistema" tipo="neutro"/>:null}
        {!p.ativo?<Selo texto="Inativo" tipo="neutro"/>:null}
      </>} rodape={larga&&pode('PERFIL_ALTERAR')?botoes:undefined}>
        <Texto variante="suave">{p.descricao||DESCRICOES_PADRAO[p.nome]||'—'}</Texto><Texto variante="suave">{p.usuarios} {p.usuarios===1?'usuário':'usuários'}</Texto>
        {larga?null:<Permitido codigo="PERFIL_ALTERAR">{botoes}</Permitido>}
      </Cartao>;
    })}
    </Grade>
    </Cartao>
    {editar?<EditorDePerfil inicial={editar==='novo'?null:editar} catalogo={catalogo} aoFechar={()=>setEditar(null)} aoSalvar={()=>{setEditar(null);recarregar();avisar('Perfil salvo.','sucesso');}}/>:null}
    <PainelConfirmacao visivel={!!excluir} titulo={`Excluir ${excluir?.nome??'perfil'}?`} mensagem="Só é possível excluir perfis sem usuários nem convites pendentes." perigo rotuloConfirmar="Excluir perfil" carregando={ocupado} aoCancelar={()=>setExcluir(null)} aoConfirmar={()=>void apagar()}/>
  </>;
}
