package br.com.treinos.api.auditoria;
import org.springframework.aop.support.StaticMethodMatcherPointcut;
import org.springframework.aop.support.DefaultPointcutAdvisor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.aopalliance.intercept.MethodInterceptor;
import java.lang.reflect.Method;

/** Transação externa (ordem 0), auditoria interna (ordem 1), ação: persistência no mesmo commit. */
@Configuration @EnableTransactionManagement(order=0) @EnableScheduling
public class AuditoriaConfiguracao {
    @Bean
    @org.springframework.context.annotation.Role(org.springframework.beans.factory.config.BeanDefinition.ROLE_INFRASTRUCTURE)
    public static DefaultPointcutAdvisor auditoriaAdvisor(@org.springframework.context.annotation.Lazy Auditoria auditoria) {
        var ponto=new StaticMethodMatcherPointcut() {
            @Override public boolean matches(Method m,Class<?> alvo) { return AnnotatedElementUtils.hasAnnotation(m,Auditar.class); }
        };
        MethodInterceptor interceptor=invocacao -> {
            var evento=AnnotatedElementUtils.findMergedAnnotation(invocacao.getMethod(),Auditar.class);
            Object resultado=invocacao.proceed();
            if(evento!=null) auditoria.registrar(evento,resultado,invocacao.getArguments());
            return resultado;
        };
        var advisor=new DefaultPointcutAdvisor(ponto,interceptor);advisor.setOrder(1);return advisor;
    }
}
