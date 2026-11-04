import { estiloPrimitivo } from '@/lib/estiloPrimitivo';
import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as TabsPrimitive from '@rn-primitives/tabs';
import * as React from 'react';
import { Platform, StyleSheet, type ViewStyle } from 'react-native';

/** Largura do anel zerada: vale por cima do `:focus-visible` do `global.css` (estilo em linha). */
const SEM_ANEL: ViewStyle = { outlineWidth: 0 };

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={cn('flex flex-col gap-2', className)} {...props} style={estiloPrimitivo(props.style)} />;
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'flex flex-row',
        Platform.select({ web: 'inline-flex w-fit', native: 'mr-auto' }),
        className
      )}
      {...props} style={estiloPrimitivo(props.style)}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const { value } = TabsPrimitive.useRootContext();
  // O @rn-primitives/tabs (web) chama `focus()` no `mousedown`; foco dado por script casa `:focus-visible`, então o
  // CLIQUE desenhava o anel de teclado. O anel some enquanto o foco veio do mouse e volta com qualquer tecla ou ao sair.
  const [porMouse, setPorMouse] = React.useState(false);
  const eventosDoMouse = Platform.OS === 'web'
    ? ({ onMouseDown: () => setPorMouse(true), onKeyDown: () => setPorMouse(false), onBlur: () => setPorMouse(false) } as object)
    : {};
  const estilo = estiloPrimitivo(props.style);
  // O primitivo entrega o estilo ao DOM sem achatar listas: por isso o achatamento aqui (como no `estiloPrimitivo`).
  const style = !porMouse ? estilo
    : typeof estilo === 'function'
      ? (((estado: Parameters<typeof estilo>[0]) => StyleSheet.flatten([estilo(estado), SEM_ANEL])) as typeof estilo)
      : (StyleSheet.flatten([estilo, SEM_ANEL]) as typeof estilo);
  return (
    <TextClassContext.Provider
      value={cn(
        'text-foreground dark:text-muted-foreground text-sm font-medium',
        value === props.value && 'dark:text-foreground'
      )}>
      <TabsPrimitive.Trigger
        className={cn(
          'flex flex-row items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 ',
          Platform.select({
            web: 'web:h-[calc(100%-1px)] inline-flex cursor-default whitespace-nowrap transition-colors disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
          }),
          props.value === value && 'bg-background dark:border-foreground/10 dark:bg-input/30',
          className
        )}
        {...eventosDoMouse}
        {...props} style={style}
      />
    </TextClassContext.Provider>
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(Platform.select({ web: 'flex-1 outline-none' }), className)}
      {...props} style={estiloPrimitivo(props.style)}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
