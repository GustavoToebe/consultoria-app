package br.com.treinos.api.web;

import br.com.plataforma.comum.web.BadRequestException;
/** Mesmo formato do Servirea: DDD, número e +55 opcional; sem ecoar o valor no erro. */
public final class Formatos {
    private Formatos() { }
    public static String telefone(String valor) {
        if(valor==null || valor.isBlank()) return null;
        String d=valor.replaceAll("\\D","");
        if((d.length()==12 || d.length()==13) && d.startsWith("55")) d=d.substring(2);
        boolean ddd=d.length()>=2 && d.charAt(0)!='0' && d.charAt(1)!='0';
        boolean fixo=d.length()==10 && d.charAt(2)>='2' && d.charAt(2)<='8';
        boolean celular=d.length()==11 && d.charAt(2)=='9';
        if(!ddd || !(fixo || celular)) throw new BadRequestException("Telefone inválido. Informe o DDD e o número.");
        int corte=d.length()-4;return "("+d.substring(0,2)+") "+d.substring(2,corte)+"-"+d.substring(corte);
    }
}
