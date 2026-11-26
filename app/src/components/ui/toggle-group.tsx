import { estiloPrimitivo } from '@/lib/estiloPrimitivo';
import { Icon } from '@/components/ui/icon';
import { TextClassContext } from '@/components/ui/text';
import { toggleVariants } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';
import * as ToggleGroupPrimitive from '@rn-primitives/toggle-group';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform } from 'react-native';

const ToggleGroupContext = React.createContext<VariantProps<typeof toggleVariants> | null>(null);

function ToggleGroup({
  className,
  variant,
  size,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <ToggleGroupPrimitive.Root
      className={cn(
        'flex flex-row items-center rounded-md ',
        Platform.select({ web: 'w-fit' }),
        variant === 'outline' && '',
        className
      )}
      {...props} style={estiloPrimitivo(props.style)}>
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  );
}

function useToggleGroupContext() {
  const context = React.useContext(ToggleGroupContext);
  if (context === null) {
    throw new Error(
      'Itens de escolha precisam estar dentro do grupo'
    );
  }
  return context;
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  isFirst,
  isLast,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
  VariantProps<typeof toggleVariants> & {
    isFirst?: boolean;
    isLast?: boolean;
  }) {
  const context = useToggleGroupContext();
  const { type, value, onValueChange } = ToggleGroupPrimitive.useRootContext();
  const espacoApertado = React.useRef(false);
  // Web: o item é um `div role="radio"` e o primitivo só trata Enter (Pressable); o Espaço (padrão ARIA) não faz nada e ainda rola a página.
  // Seleciona ao soltar, como o botão nativo, pelo mesmo caminho do clique (`onPress` do primitivo).
  const teclaEspaco = Platform.OS === 'web' && !props.disabled ? {
    onKeyDown: (e: { key: string; preventDefault: () => void; repeat?: boolean }) => { if (e.key === ' ') { e.preventDefault(); if (!e.repeat) espacoApertado.current = true; } },
    onKeyUp: (e: { key: string }) => {
      if (e.key !== ' ' || !espacoApertado.current) return;
      espacoApertado.current = false;
      if (type === 'single') onValueChange(ToggleGroupPrimitive.utils.getNewSingleValue(value as string | undefined, props.value));
      else onValueChange(ToggleGroupPrimitive.utils.getNewMultipleValue(value as string[] | undefined, props.value));
    },
  } : null;

  return (
    <TextClassContext.Provider
      value={cn(
        'text-sm text-foreground font-medium',
        ToggleGroupPrimitive.utils.getIsSelected(value, props.value)
          ? 'text-accent-foreground'
          : Platform.select({ web: 'group-hover:text-muted-foreground' })
      )}>
      <ToggleGroupPrimitive.Item
        className={cn(
          toggleVariants({
            variant: context.variant || variant,
            size: context.size || size,
          }),
          ToggleGroupPrimitive.utils.getIsSelected(value, props.value) && 'bg-accent',
          'min-h-11 min-w-11 shrink-0 rounded-md ',
          isFirst && 'rounded-l-md',
          isLast && 'rounded-r-md',
          (context.variant === 'outline' || variant === 'outline') && 'border-l-0',
          (context.variant === 'outline' || variant === 'outline') && isFirst && 'border-l',
          Platform.select({
            web: 'flex-1 focus:z-10 focus-visible:z-10',
          }),
          className
        )}
        {...teclaEspaco} {...props} style={estiloPrimitivo(props.style)}>
        {children}
      </ToggleGroupPrimitive.Item>
    </TextClassContext.Provider>
  );
}

function ToggleGroupIcon({ className, ...props }: React.ComponentProps<typeof Icon>) {
  const textClass = React.useContext(TextClassContext);
  return <Icon className={cn('size-4 shrink-0', textClass, className)} {...props} style={estiloPrimitivo(props.style)} />;
}

export { ToggleGroup, ToggleGroupIcon, ToggleGroupItem };
