import Anthropic from '@anthropic-ai/sdk';
import { ResponseCreateParamsStreaming } from 'openai/resources/responses/responses.js';
import OpenAI from 'openai';
import { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';

interface TSchema {
}
interface TSchemaOptions {
    /**
     * Allows for additional, unlisted properties to be included, typically for extensibility.
     */
    [key: PropertyKey]: unknown;
    /**
     * Specifies the URI of a JSON Schema that the current schema adheres to.
     */
    $schema?: string;
    /**
     * A URI that serves as a unique identifier for the schema.
     */
    $id?: string;
    /**
     * A short explanation about the purpose of the data described by the schema.
     */
    title?: string;
    /**
     * A detailed explanation of the data described by the schema.
     */
    description?: string;
    /**
     * A default value for the data, used when no value is provided.
     */
    default?: unknown;
    /**
     * Provides one or more examples of valid data conforming to the schema.
     */
    examples?: unknown;
    /**
     * Indicates that the data should only be readable and not modified.
     */
    readOnly?: boolean;
    /**
     * Indicates that the data should only be writable and not read back.
     */
    writeOnly?: boolean;
    /**
     * A schema to apply conditionally: if the data validates against this schema, 'then' applies.
     */
    if?: TSchema;
    /**
     * A schema to apply if the data validates against the 'if' schema.
     */
    then?: TSchema;
    /**
     * A schema to apply if the data does not validate against the 'if' schema.
     */
    else?: TSchema;
}
interface TObjectOptions extends TSchemaOptions {
    /**
     * Defines whether additional properties are allowed beyond those explicitly defined in `properties`.
     */
    additionalProperties?: TSchema | boolean;
    /**
     * The minimum number of properties required in the object.
     */
    minProperties?: number;
    /**
     * The maximum number of properties allowed in the object.
     */
    maxProperties?: number;
    /**
     * Defines conditional requirements for properties.
     */
    dependencies?: Record<string, boolean | TSchema | string[]>;
    /**
     * Specifies properties that *must* be present if a given property is present.
     */
    dependentRequired?: Record<string, string[]>;
    /**
     * Defines schemas that apply if a specific property is present.
     */
    dependentSchemas?: Record<string, TSchema>;
    /**
     * Maps regular expressions to schemas properties matching a pattern must validate against the schema.
     */
    patternProperties?: Record<string, TSchema>;
    /**
     * A schema that all property names within the object must validate against.
     */
    propertyNames?: TSchema;
}

/** Represents a deferred action. */
interface TDeferred<Action extends string = string, Types extends TSchema[] = TSchema[]> extends TSchema {
    '~kind': 'Deferred';
    type: 'deferred';
    action: Action;
    parameters: Types;
    options: TSchemaOptions;
}

type StaticCodec<Stack extends string[], Direction extends StaticDirection, Context extends TProperties, This extends TProperties, Type extends TSchema, Decoded extends unknown> = (Direction extends 'Decode' ? Decoded : StaticType<Stack, Direction, Context, This, Omit<Type, '~codec'>>);
type TDecodeCallback<Encoded extends unknown, Decoded = unknown> = (input: Encoded) => Decoded;
type TEncodeCallback<Encoded extends unknown, Decoded = unknown> = (input: Decoded) => Encoded;
type TCodec<Type extends TSchema = TSchema, Decoded extends unknown = unknown> = Type & {
    '~codec': {
        encode: TDecodeCallback<unknown, Decoded>;
        decode: TEncodeCallback<unknown, Decoded>;
    };
};

type StaticAny = any;
/** Represents a Any type. */
interface TAny extends TSchema {
    '~kind': 'Any';
}

type TImmutable<Type extends TSchema = TSchema> = (Type & {
    '~immutable': true;
});

type StaticArray<Stack extends string[], Direction extends StaticDirection, Context extends TProperties, This extends TProperties, Array extends TSchema, Item extends TSchema, Result extends readonly unknown[] = Array extends TImmutable ? readonly StaticType<Stack, Direction, Context, This, Item>[] : StaticType<Stack, Direction, Context, This, Item>[]> = Result;
/** Represents an Array type. */
interface TArray<Type extends TSchema = TSchema> extends TSchema {
    '~kind': 'Array';
    type: 'array';
    items: Type;
}

declare const BigIntPattern = "-?(?:0|[1-9][0-9]*)n";
type StaticBigInt = bigint;
/** Represents a BigInt type. */
interface TBigInt extends TSchema {
    '~kind': 'BigInt';
    type: 'bigint';
}

type StaticBoolean = boolean;
/** Represents a Boolean type. */
interface TBoolean extends TSchema {
    '~kind': 'Boolean';
    type: 'boolean';
}

/** Applies an AddReadonly action to a type. */
type TAddReadonly<Type extends TSchema> = (TAddReadonlyAction<Type>);

type TReadonly<Type extends TSchema = TSchema> = (Type & {
    '~readonly': true;
});

type TAddReadonlyOperation<Type extends TSchema, Result extends TSchema = `~readonly` extends keyof Type ? Type : TReadonly<Type>> = Result;
type TAddReadonlyAction<Type extends TSchema, Result extends TSchema = TAddReadonlyOperation<Type>> = Result;
type TAddReadonlyInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, InstantiateType extends TSchema = TInstantiateType<Context, State, Type>> = TAddReadonlyAction<InstantiateType>;

type StaticUnknown = unknown;
/** Represents an Unknown type. */
interface TUnknown extends TSchema {
    '~kind': 'Unknown';
}

/** Represents a Generic parameter. */
interface TParameter<Name extends string = string, Extends extends TSchema = TSchema, Equals extends TSchema = TSchema> extends TSchema {
    '~kind': 'Parameter';
    name: Name;
    extends: Extends;
    equals: Equals;
}

type StaticObject<Stack extends string[], Direction extends StaticDirection, Context extends TProperties, _This extends TProperties, Properties extends TProperties, Result = keyof Properties extends never ? object : StaticProperties<Stack, Direction, Context, Properties, Properties>> = Result;
/** Represents an Object type. */
interface TObject<Properties extends TProperties = TProperties> extends TSchema {
    '~kind': 'Object';
    type: 'object';
    properties: Properties;
    required: TRequiredArray<Properties>;
}

type CyclicStackLength<Stack extends unknown[], MaxLength extends number, Buffer extends unknown[] = []> = (Stack extends [infer Left, ...infer Right] ? Buffer['length'] extends MaxLength ? false : CyclicStackLength<Right, MaxLength, [...Buffer, Left]> : true);
type CyclicGuard<Stack extends unknown[], Ref extends string> = (Ref extends Stack[number] ? CyclicStackLength<Stack, 2> : true);
type StaticGuardedRef<Stack extends string[], Direction extends StaticDirection, Context extends TProperties, This extends TProperties, Ref extends string, Type extends TSchema> = (CyclicGuard<Stack, Ref> extends true ? StaticType<[...Stack, Ref], Direction, Context, This, Type> : any);
type StaticRef<Stack extends string[], Direction extends StaticDirection, Context extends TProperties, This extends TProperties, Ref extends string, Target extends TSchema = Ref extends keyof Context ? Context[Ref] : TUnknown, Result extends unknown = Target extends TObject ? StaticType<[], Direction, Context, This, Target> : StaticGuardedRef<Stack, Direction, Context, This, Ref, Target>> = Result;
/** Represents a type reference. */
interface TRef<Ref extends string = string> extends TSchema {
    '~kind': 'Ref';
    $ref: Ref;
}

/** Represents a callable Generic type. */
interface TGeneric<Parameters extends TParameter[] = TParameter[], Expression extends TSchema = TSchema> extends TSchema {
    '~kind': 'Generic';
    type: 'generic';
    parameters: Parameters;
    expression: Expression;
}

declare const NeverPattern = "(?!)";
type StaticNever = never;
/** Represents a Never type. */
interface TNever extends TSchema {
    '~kind': 'Never';
    not: {};
}

type StaticCyclic<Stack extends string[], Direction extends StaticDirection, Context extends TProperties, This extends TProperties, Defs extends TProperties, Ref extends string, Result extends unknown = (Ref extends keyof Defs ? StaticType<[...Stack, Ref], Direction, Defs, This, Defs[Ref]> : never)> = Result;
/** Represents a Cyclic type. */
interface TCyclic<Defs extends TProperties = TProperties, Ref extends string = string> extends TSchema {
    '~kind': 'Cyclic';
    $defs: Defs;
    $ref: Ref;
}

type TUnionToIntersect<U> = (U extends unknown ? (arg: U) => 0 : never) extends (arg: infer I) => 0 ? I : never;
type TUnionLast<U> = TUnionToIntersect<U extends unknown ? (x: U) => 0 : never> extends (x: infer L) => 0 ? L : never;
type TUnionToTuple<U, Result extends unknown[] = [], R = TUnionLast<U>> = [U] extends [never] ? Result : TUnionToTuple<Exclude<U, R>, [Extract<U, R>, ...Result]>;

type StaticEnum<Values extends TEnumValue[]> = (Values[number]);
type TEnumValue = string | number;
/** Represents an Enum type. */
interface TEnum<Values extends TEnumValue[] = TEnumValue[]> extends TSchema {
    '~kind': 'Enum';
    enum: Values;
}

/** Represents a Identifier. */
interface TIdentifier<Name extends string = string> extends TSchema {
    '~kind': 'Identifier';
    type: 'identifier';
    name: Name;
}

type StaticDependent<Stack extends string[], Direction extends StaticDirection, Context extends TProperties, This extends TProperties, If extends TSchema, Then extends TSchema, Else extends TSchema, StaticIf extends unknown = StaticType<Stack, Direction, Context, This, If>, StaticThen extends unknown = StaticType<Stack, Direction, Context, This, Then>, StaticElse extends unknown = StaticType<Stack, Direction, Context, This, Else>, Result extends unknown = (StaticIf & StaticThen) | Exclude<StaticElse, StaticIf>> = Result;
/** Represents a Dependent Type */
interface TDependent<If extends TSchema = TSchema, Then extends TSchema = TSchema, Else extends TSchema = TSchema> extends TSchema {
    '~kind': 'Dependent';
    if: If;
    then: Then;
    else: Else;
}

/** Represents an Infer instruction. */
interface TInfer<Name extends string = string, Extends extends TSchema = TSchema> extends TSchema {
    '~kind': 'Infer';
    type: 'infer';
    name: Name;
    extends: Extends;
}

declare const IntegerPattern = "-?(?:0|[1-9][0-9]*)";
type StaticInteger = number;
/** Represents an integer type. */
interface TInteger extends TSchema {
    '~kind': 'Integer';
    type: 'integer';
}

type StaticIntersect<Stack extends string[], Direction extends StaticDirection, Context extends TProperties, This extends TProperties, Types extends TSchema[], Result extends unknown = unknown> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? StaticIntersect<Stack, Direction, Context, This, Right, Result & StaticType<Stack, Direction, Context, This, Left>> : Result);
/** Represents a logical Intersect type. */
interface TIntersect<Types extends TSchema[] = TSchema[]> extends TSchema {
    '~kind': 'Intersect';
    allOf: Types;
}

type StaticLiteral<Value extends TLiteralValue> = (Value);
type TLiteralTypeName<Value extends TLiteralValue> = (Value extends bigint ? 'bigint' : Value extends boolean ? 'boolean' : Value extends number ? 'number' : Value extends string ? 'string' : never);
type TLiteralValue = string | number | boolean | bigint;
/** Represents a Literal type. */
interface TLiteral<Value extends TLiteralValue = TLiteralValue> extends TSchema {
    '~kind': 'Literal';
    type: TLiteralTypeName<Value>;
    const: Value;
}

type StaticNull = null;
/** Represents a Null type. */
interface TNull extends TSchema {
    '~kind': 'Null';
    type: 'null';
}

declare const NumberPattern = "-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?";
type StaticNumber = number;
/** Represents a Number type. */
interface TNumber extends TSchema {
    '~kind': 'Number';
    type: 'number';
}

type StaticSymbol = symbol;
/** Represents a Symbol type. */
interface TSymbol extends TSchema {
    '~kind': 'Symbol';
    type: 'symbol';
}

declare const StringPattern = ".*";
type StaticString = string;
/** Represents a String type. */
interface TString extends TSchema {
    '~kind': 'String';
    type: 'string';
}

type TUnreachable = never;

type ObjectLike = Record<PropertyKey, any>;
/**
 * Performs an Object assign using the Left and Right object types. We track this operation as it
 * creates a new GC handle per assignment.
 */
type TAssign<Left extends ObjectLike, Right extends ObjectLike, Assigned extends ObjectLike = Omit<Left, keyof Right> & Right> = {
    [Key in keyof Assigned]: Assigned[Key];
} & {};

type TPatternBigIntMapping<Input extends '-?(?:0|[1-9][0-9]*)n'> = (TBigInt);
type TPatternStringMapping<Input extends '.*'> = (TString);
type TPatternNumberMapping<Input extends '-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?'> = (TNumber);
type TPatternIntegerMapping<Input extends '-?(?:0|[1-9][0-9]*)'> = (TInteger);
type TPatternNeverMapping<Input extends '(?!)'> = (TNever);
type TPatternTextMapping<Input extends string, Result extends TSchema = TLiteral<Input>> = Result;
type TPatternBaseMapping<Input extends unknown> = (Input);
type TPatternGroupMapping<Input extends [unknown, unknown, unknown]> = (Input extends ['(', infer Body extends TSchema[], ')'] ? TUnion<Body> : never);
type TPatternUnionMapping<Input extends [unknown, unknown, unknown] | [unknown] | []> = (Input extends [infer Term extends TSchema[], '|', infer Union extends TSchema[]] ? [...Term, ...Union] : Input extends [infer Term extends TSchema[]] ? [...Term] : [
]);
type TPatternTermMapping<Input extends [unknown, unknown]> = (Input extends [infer Left extends TSchema, infer Right extends TSchema[]] ? [Left, ...Right] : never);
type TPatternBodyMapping<Input extends unknown> = (Input);
type TPatternMapping<Input extends [unknown, unknown, unknown]> = (Input extends ['^', infer Body extends TSchema[], '$'] ? Body : never);

type TTakeVariant<Variant extends string, Input extends string> = (Input extends `${Variant}${infer Rest extends string}` ? [Variant, Rest] : []);
/** Takes one of the given variants or fail */
type TTake<Variants extends string[], Input extends string> = (Variants extends [infer ValueLeft extends string, ...infer ValueRight extends string[]] ? TTakeVariant<ValueLeft, Input> extends [infer Take extends string, infer Rest extends string] ? [Take, Rest] : TTake<ValueRight, Input> : []);

declare const WhiteSpace = " ";
declare const NewLine = "\n";
declare const TabSpace = "\t";
type TWhiteSpace = typeof WhiteSpace;
type TNewLine = typeof NewLine;
type TTabSpace = typeof TabSpace;

type LineComment = typeof LineComment;
declare const LineComment = "//";
type OpenComment = typeof OpenComment;
declare const OpenComment = "/*";
type CloseComment = typeof CloseComment;
declare const CloseComment = "*/";
type TDiscardMultiLineComment<Input extends string> = (Input extends `${string}${CloseComment}${infer Rest extends string}` ? Rest : '');
type TDiscardLineComment<Input extends string> = (Input extends `${string}${TNewLine}${infer Rest extends string}` ? TTrimWhitespace<`${TNewLine}${Rest}`> : '');
type W4 = `${W3}${W3}`;
type W3 = `${W2}${W2}`;
type W2 = `${W1}${W1}`;
type W1 = `${W0}${W0}`;
type W0 = ` `;
type TTrimWhitespace<Input extends string> = (Input extends `${OpenComment}${infer Rest extends string}` ? TTrimWhitespace<TDiscardMultiLineComment<Rest>> : Input extends `${LineComment}${infer Rest extends string}` ? TTrimWhitespace<TDiscardLineComment<Rest>> : Input extends `${W4}${infer Rest extends string}` ? TTrimWhitespace<Rest> : Input extends `${W3}${infer Rest extends string}` ? TTrimWhitespace<Rest> : Input extends `${W1}${infer Rest extends string}` ? TTrimWhitespace<Rest> : Input extends `${W0}${infer Rest extends string}` ? TTrimWhitespace<Rest> : Input);
type TTrim<Input extends string> = (Input extends `${OpenComment}${infer Rest extends string}` ? TTrim<TDiscardMultiLineComment<Rest>> : Input extends `${LineComment}${infer Rest extends string}` ? TTrim<TDiscardLineComment<Rest>> : Input extends `${TNewLine}${infer Rest extends string}` ? TTrim<Rest> : Input extends `${TTabSpace}${infer Rest extends string}` ? TTrim<Rest> : Input extends `${W4}${infer Rest extends string}` ? TTrim<Rest> : Input extends `${W3}${infer Rest extends string}` ? TTrim<Rest> : Input extends `${W1}${infer Rest extends string}` ? TTrim<Rest> : Input extends `${W0}${infer Rest extends string}` ? TTrim<Rest> : Input);

type TTakeConst<Const extends string, Input extends string> = (TTake<[Const], Input>);
/** Matches if next is the given Const value */
type TConst<Const extends string, Input extends string> = (Const extends '' ? ['', Input] : Const extends `${infer First extends string}${string}` ? (First extends TNewLine ? TTakeConst<Const, TTrimWhitespace<Input>> : First extends TWhiteSpace ? TTakeConst<Const, Input> : TTakeConst<Const, TTrim<Input>>) : never);

type TTakeOne<Input extends string> = (Input extends `${infer Left extends string}${infer Right extends string}` ? [Left, Right] : []);
type TIsInputMatchSentinal<End extends string[], Input extends string> = (End extends [infer Left extends string, ...infer Right extends string[]] ? Input extends `${Left}${string}` ? true : TIsInputMatchSentinal<Right, Input> : false);
/** Match Input until but not including End. No match if End not found. */
type TUntil<End extends string[], Input extends string, Result extends string = ''> = (TTakeOne<Input> extends [infer One extends string, infer Rest extends string] ? TIsInputMatchSentinal<End, Input> extends true ? [Result, Input] : TUntil<End, Rest, `${Result}${One}`> : []);

/** Match Input until but not including End. No match if End not found or match is zero-length. */
type TUntil_1<End extends string[], Input extends string> = (TUntil<End, Input> extends [infer Until extends string, infer UntilRest extends string] ? Until extends '' ? [] : [Until, UntilRest] : []);

type TPatternBigInt<Input extends string> = TConst<'-?(?:0|[1-9][0-9]*)n', Input> extends [infer _0 extends '-?(?:0|[1-9][0-9]*)n', infer Input extends string] ? [TPatternBigIntMapping<_0>, Input] : [];
type TPatternString<Input extends string> = TConst<'.*', Input> extends [infer _0 extends '.*', infer Input extends string] ? [TPatternStringMapping<_0>, Input] : [];
type TPatternNumber<Input extends string> = TConst<'-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?', Input> extends [infer _0 extends '-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?', infer Input extends string] ? [TPatternNumberMapping<_0>, Input] : [];
type TPatternInteger<Input extends string> = TConst<'-?(?:0|[1-9][0-9]*)', Input> extends [infer _0 extends '-?(?:0|[1-9][0-9]*)', infer Input extends string] ? [TPatternIntegerMapping<_0>, Input] : [];
type TPatternNever<Input extends string> = TConst<'(?!)', Input> extends [infer _0 extends '(?!)', infer Input extends string] ? [TPatternNeverMapping<_0>, Input] : [];
type TPatternText<Input extends string> = TUntil_1<['-?(?:0|[1-9][0-9]*)n', '.*', '-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?', '-?(?:0|[1-9][0-9]*)', '(?!)', '(', ')', '$', '|'], Input> extends [infer _0 extends string, infer Input extends string] ? [TPatternTextMapping<_0>, Input] : [];
type TPatternBase<Input extends string> = (TPatternBigInt<Input> extends [infer _0, infer Input extends string] ? [_0, Input] : TPatternString<Input> extends [infer _0, infer Input extends string] ? [_0, Input] : TPatternNumber<Input> extends [infer _0, infer Input extends string] ? [_0, Input] : TPatternInteger<Input> extends [infer _0, infer Input extends string] ? [_0, Input] : TPatternNever<Input> extends [infer _0, infer Input extends string] ? [_0, Input] : TPatternGroup<Input> extends [infer _0, infer Input extends string] ? [_0, Input] : TPatternText<Input> extends [infer _0, infer Input extends string] ? [_0, Input] : []) extends [infer _0 extends unknown, infer Input extends string] ? [TPatternBaseMapping<_0>, Input] : [];
type TPatternGroup<Input extends string> = (TConst<'(', Input> extends [infer _0, infer Input extends string] ? (TPatternBody<Input> extends [infer _1, infer Input extends string] ? (TConst<')', Input> extends [infer _2, infer Input extends string] ? [[_0, _1, _2], Input] : []) : []) : []) extends [infer _0 extends [unknown, unknown, unknown], infer Input extends string] ? [TPatternGroupMapping<_0>, Input] : [];
type TPatternUnion<Input extends string> = ((TPatternTerm<Input> extends [infer _0, infer Input extends string] ? (TConst<'|', Input> extends [infer _1, infer Input extends string] ? (TPatternUnion<Input> extends [infer _2, infer Input extends string] ? [[_0, _1, _2], Input] : []) : []) : []) extends [infer _0, infer Input extends string] ? [_0, Input] : (TPatternTerm<Input> extends [infer _0, infer Input extends string] ? [[_0], Input] : []) extends [infer _0, infer Input extends string] ? [_0, Input] : [[], Input] extends [infer _0, infer Input extends string] ? [_0, Input] : []) extends [infer _0 extends [unknown, unknown, unknown] | [unknown] | [], infer Input extends string] ? [TPatternUnionMapping<_0>, Input] : [];
type TPatternTerm<Input extends string> = (TPatternBase<Input> extends [infer _0, infer Input extends string] ? (TPatternBody<Input> extends [infer _1, infer Input extends string] ? [[_0, _1], Input] : []) : []) extends [infer _0 extends [unknown, unknown], infer Input extends string] ? [TPatternTermMapping<_0>, Input] : [];
type TPatternBody<Input extends string> = (TPatternUnion<Input> extends [infer _0, infer Input extends string] ? [_0, Input] : TPatternTerm<Input> extends [infer _0, infer Input extends string] ? [_0, Input] : []) extends [infer _0 extends unknown, infer Input extends string] ? [TPatternBodyMapping<_0>, Input] : [];
type TPattern<Input extends string> = (TConst<'^', Input> extends [infer _0, infer Input extends string] ? (TPatternBody<Input> extends [infer _1, infer Input extends string] ? (TConst<'$', Input> extends [infer _2, infer Input extends string] ? [[_0, _1, _2], Input] : []) : []) : []) extends [infer _0 extends [unknown, unknown, unknown], infer Input extends string] ? [TPatternMapping<_0>, Input] : [];

type StaticUnion<Stack extends string[], Direction extends StaticDirection, Context extends TProperties, This extends TProperties, Types extends TSchema[], Result extends unknown = never> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? StaticUnion<Stack, Direction, Context, This, Right, Result | StaticType<Stack, Direction, Context, This, Left>> : Result);
/** Represents a logical Union type. */
interface TUnion<Types extends TSchema[] = TSchema[]> extends TSchema {
    '~kind': 'Union';
    anyOf: Types;
}

/** Parses a Pattern into a sequence of TemplateLiteral types. A result of [] indicates failure to parse. */
type TParsePatternIntoTypes<Pattern extends string, Parsed extends [TSchema[], string] | [] = TPattern<Pattern>, Result extends TSchema[] = Parsed extends [infer Types extends TSchema[], string] ? Types : []> = Result;

type TFromLiteral$5<Template extends string, Value extends TLiteralValue> = `${Template}${Value}`;
type TFromBigInt<Template extends string> = `${Template}${bigint}`;
type TFromString<Template extends string> = `${Template}${string}`;
type TFromNumber<Template extends string> = `${Template}${number}`;
type TFromInteger<Template extends string> = `${Template}${number}`;
type TFromUnion$8<Template extends string, Types extends TSchema[], Result extends string = never> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TFromUnion$8<Template, Right, Result | TFromType$i<'', Left>> : `${Template}${Result}`);
type TFromType$i<Template extends string, Type extends TSchema, Result extends string = (Type extends TUnion<infer Types extends TSchema[]> ? TFromUnion$8<Template, Types> : Type extends TLiteral<infer Value extends TLiteralValue> ? TFromLiteral$5<Template, Value> : Type extends TBigInt ? TFromBigInt<Template> : Type extends TString ? TFromString<Template> : Type extends TNumber ? TFromNumber<Template> : Type extends TInteger ? TFromInteger<Template> : never)> = Result;
type TFromSpan<Template extends string, Types extends TSchema[]> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TFromSpan<TFromType$i<Template, Left>, Right> : Template);
type TTemplateLiteralStatic<Pattern extends string, Types extends TSchema[] = TParsePatternIntoTypes<Pattern>> = TFromSpan<'', Types>;

type TRemoveReadonlyOperation<Type extends TSchema, Result extends TSchema = Type extends TReadonly<infer Type extends TSchema> ? TRemoveReadonlyOperation<Type> : Type> = Result;
type TRemoveReadonlyAction<Type extends TSchema, Result extends TSchema = TRemoveReadonlyOperation<Type>> = Result;
type TRemoveReadonlyInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, InstantiateType extends TSchema = TInstantiateType<Context, State, Type>> = TRemoveReadonlyAction<InstantiateType>;

/** Applies an RemoveReadonly action to a type. */
type TRemoveReadonly<Type extends TSchema> = (TRemoveReadonlyAction<Type>);

type TRemoveOptionalOperation<Type extends TSchema, Result extends TSchema = Type extends TOptional<infer Type extends TSchema> ? TRemoveOptionalOperation<Type> : Type> = Result;
type TRemoveOptionalAction<Type extends TSchema, Result extends TSchema = TRemoveOptionalOperation<Type>> = Result;
type TRemoveOptionalInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, InstantiateType extends TSchema = TInstantiateType<Context, State, Type>> = TRemoveOptionalAction<InstantiateType>;

/** Applies an RemoveOptional action to a type. */
type TRemoveOptional<Type extends TSchema> = (TRemoveOptionalAction<Type>);

type TTupleElementsToProperties<Types extends TSchema[], Result extends TProperties = {}> = (Types extends [...infer Left extends TSchema[], infer Right extends TSchema] ? TTupleElementsToProperties<Left, {
    [_ in Left['length']]: Right;
} & Result> : {
    [Key in keyof Result]: Result[Key];
});
type TTupleToObject<Type extends TTuple, Properties extends TProperties = TTupleElementsToProperties<Type['items']>, Result extends TSchema = TObject<Properties>> = Result;

/** Returns true if the type is a valid operand to Composite. */
type TCanComposite<Type extends TSchema> = (Type extends TObject<infer _ extends TProperties> ? true : Type extends TTuple<infer _ extends TSchema[]> ? true : false);
type TIsReadonlyProperty<Left extends TSchema, Right extends TSchema> = (Left extends TReadonly<Left> ? Right extends TReadonly<Right> ? true : false : false);
type TIsOptionalProperty<Left extends TSchema, Right extends TSchema> = (Left extends TOptional<Left> ? Right extends TOptional<Right> ? true : false : false);
type TCompositeProperty<Left extends TSchema, Right extends TSchema, IsReadonly extends boolean = TIsReadonlyProperty<Left, Right>, IsOptional extends boolean = TIsOptionalProperty<Left, Right>, Evaluated extends TSchema = TEvaluateIntersect<[Left, Right]>, Property extends TSchema = TRemoveReadonly<TRemoveOptional<Evaluated>>> = ([
    IsReadonly,
    IsOptional
] extends [true, true] ? TAddReadonly<TAddOptional<Property>> : [
    IsReadonly,
    IsOptional
] extends [true, false] ? TAddReadonly<Property> : [
    IsReadonly,
    IsOptional
] extends [false, true] ? TAddOptional<Property> : Property);
type TCompositePropertyKey<Left extends TProperties, Right extends TProperties, Key extends PropertyKey, Result extends TSchema = (Key extends keyof Left ? Key extends keyof Right ? TCompositeProperty<Left[Key], Right[Key]> : Left[Key] : Key extends keyof Right ? Right[Key] : TNever)> = Result;
type TCompositeProperties<Left extends TProperties, Right extends TProperties, Keys extends PropertyKey = keyof (Left & Right), Result extends TProperties = {
    [Key in Keys]: TCompositePropertyKey<Left, Right, Key>;
}> = Result;
type TGetProperties<Type extends TSchema, Result extends TProperties = (Type extends TObject<infer Properties extends TProperties> ? Properties : Type extends TTuple<infer Types extends TSchema[]> ? TTupleElementsToProperties<Types> : {})> = Result;
type TComposite<Left extends TSchema, Right extends TSchema, LeftProperties extends TProperties = TGetProperties<Left>, RightProperties extends TProperties = TGetProperties<Right>, Properties extends TProperties = TCompositeProperties<LeftProperties, RightProperties>, Result extends TSchema = TObject<Properties>> = Result;

type TNarrowCompareRule<Left extends TSchema, Right extends TSchema, Result extends TCompareResult = TCompare<Left, Right>> = (Result extends typeof CompareResultLeftInside ? Left : Result extends typeof CompareResultRightInside ? Right : Result extends typeof CompareResultEqual ? Right : TNever);
type TNarrowCompositeRule<Left extends TSchema, Right extends TSchema, CanCompositeLeft extends boolean = TCanComposite<Left>, CanCompositeRight extends boolean = TCanComposite<Right>> = ([
    CanCompositeLeft,
    CanCompositeRight
] extends [true, true] ? TComposite<Left, Right> : [
    CanCompositeLeft,
    CanCompositeRight
] extends [true, false] ? Left : [
    CanCompositeLeft,
    CanCompositeRight
] extends [false, true] ? Right : TNarrowCompareRule<Left, Right>);
type TNarrow<Left extends TSchema, Right extends TSchema> = (Left extends TNever ? TNever : Left extends TAny ? TAny : Left extends TUnknown ? Right : Right extends TNever ? TNever : Right extends TAny ? TAny : Right extends TUnknown ? Left : TNarrowCompositeRule<Left, Right>);

type TShouldEvaluate<Left extends TSchema, Right extends TSchema, IsUnionLeft extends boolean = Left extends TUnion ? true : false, IsUnionRight extends boolean = Right extends TUnion ? true : false, Result extends boolean = IsUnionLeft extends true ? true : IsUnionRight extends true ? true : false> = Result;
type TDistributeOperation<Left extends TSchema, Right extends TSchema, EvaluatedLeft extends TSchema = TEvaluateType<Left>, EvaluatedRight extends TSchema = TEvaluateType<Right>, ShouldEvaluate extends boolean = TShouldEvaluate<EvaluatedLeft, EvaluatedRight>, Result extends TSchema = [ShouldEvaluate] extends [true] ? TEvaluateIntersect<[EvaluatedLeft, EvaluatedRight]> : TNarrow<EvaluatedLeft, EvaluatedRight>> = Result;
type TDistributeType<Type extends TSchema, Distribution extends TSchema[], Result extends TSchema[] = []> = (Distribution extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TDistributeType<Type, Right, [...Result, TDistributeOperation<Left, Type>]> : Result extends [] ? [Type] : Result);
type TDistributeUnion<Types extends TSchema[], Distribution extends TSchema[], Result extends TSchema[] = []> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TDistributeUnion<Right, Distribution, [...Result, ...TDistribute$1<[Left], Distribution>]> : Result);
type TDistribute$1<Types extends TSchema[], Result extends TSchema[] = []> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? Left extends TUnion<infer UnionTypes extends TSchema[]> ? TDistribute$1<Right, TDistributeUnion<UnionTypes, Result>> : TDistribute$1<Right, TDistributeType<Left, Result>> : Result);

type StaticUnsafe<Type extends unknown> = Type;
/** Represents an Unsafe type. */
interface TUnsafe<Type extends unknown = unknown> extends TSchema {
    '~unsafe': Type;
}

type TResult = TExtendsUnion$1 | TExtendsTrue | TExtendsFalse;
interface TExtendsUnion$1<Inferred extends TProperties = TProperties> {
    '~kind': 'ExtendsUnion';
    inferred: Inferred;
}
interface TExtendsTrue<Inferred extends TProperties = TProperties> {
    '~kind': 'ExtendsTrue';
    inferred: Inferred;
}
interface TExtendsFalse {
    type: 'ExtendsFalse';
}
type TExtendsTrueLike<Inferred extends TProperties = TProperties> = TExtendsUnion$1<Inferred> | TExtendsTrue<Inferred>;

type TExtendsRightInfer<Inferred extends TProperties, Name extends string, Left extends TSchema, Right extends TSchema, Result extends TResult = (TExtendsLeft<Inferred, Left, Right> extends TExtendsTrueLike<infer CheckInferred extends TProperties> ? TExtendsTrue<TAssign<TAssign<Inferred, CheckInferred>, {
    [_ in Name]: Left;
}>> : TExtendsFalse)> = Result;
type TExtendsRightAny<Inferred extends TProperties, _Left extends TSchema, Result extends TResult = TExtendsTrue<Inferred>> = Result;
type TExtendsRightDependent<Inferred extends TProperties, Left extends TSchema, If extends TSchema, Then extends TSchema, Else extends TSchema, Result extends TResult = TExtendsLeft<Inferred, Left, If> extends TExtendsTrueLike<infer Inferred extends TProperties> ? (TExtendsLeft<Inferred, Left, Then> extends TExtendsTrueLike<infer Inferred extends TProperties> ? TExtendsTrue<Inferred> : TExtendsFalse) : (TExtendsLeft<Inferred, Left, Else> extends TExtendsTrueLike<infer Inferred extends TProperties> ? TExtendsTrue<Inferred> : TExtendsFalse)> = Result;
type TExtendsRightEnum<Inferred extends TProperties, Left extends TSchema, Right extends TEnumValue[], Evaluated extends TSchema = TEvaluateEnum<Right>> = TExtendsLeft<Inferred, Left, Evaluated>;
type TExtendsRightIntersect<Inferred extends TProperties, Left extends TSchema, Right extends TSchema[]> = (Right extends [infer Head extends TSchema, ...infer Tail extends TSchema[]] ? TExtendsLeft<Inferred, Left, Head> extends TExtendsTrueLike<infer Inferred extends TProperties> ? TExtendsRightIntersect<Inferred, Left, Tail> : TExtendsFalse : TExtendsTrue<Inferred>);
type TExtendsRightTemplateLiteral<Inferred extends TProperties, Left extends TSchema, Right extends string, Evaluated extends TSchema = TEvaluateTemplateLiteral<Right>> = TExtendsLeft<Inferred, Left, Evaluated>;
type TExtendsRightUnion<Inferred extends TProperties, Left extends TSchema, Right extends TSchema[]> = (Right extends [infer Head extends TSchema, ...infer Tail extends TSchema[]] ? TExtendsLeft<Inferred, Left, Head> extends TExtendsTrueLike<infer Inferred extends TProperties> ? TExtendsTrue<Inferred> : TExtendsRightUnion<Inferred, Left, Tail> : TExtendsFalse);
type TExtendsRight<Inferred extends TProperties, Left extends TSchema, Right extends TSchema> = (Right extends TAny ? TExtendsRightAny<Inferred, Left> : Right extends TDependent<infer If extends TSchema, infer Then extends TSchema, infer Else extends TSchema> ? TExtendsRightDependent<Inferred, Left, If, Then, Else> : Right extends TEnum<infer Values extends TEnumValue[]> ? TExtendsRightEnum<Inferred, Left, Values> : Right extends TInfer<infer Name extends string, infer Type extends TSchema> ? TExtendsRightInfer<Inferred, Name, Left, Type> : Right extends TTemplateLiteral<infer Pattern extends string> ? TExtendsRightTemplateLiteral<Inferred, Left, Pattern> : Right extends TIntersect<infer Types extends TSchema[]> ? TExtendsRightIntersect<Inferred, Left, Types> : Right extends TUnion<infer Types extends TSchema[]> ? TExtendsRightUnion<Inferred, Left, Types> : Right extends TUnknown ? TExtendsTrue<Inferred> : TExtendsFalse);

type TExtendsAny<Inferred extends TProperties, Left extends TAny, Right extends TSchema> = (Right extends TInfer ? TExtendsRight<Inferred, Left, Right> : Right extends TAny ? TExtendsTrue<Inferred> : Right extends TUnknown ? TExtendsTrue<Inferred> : TExtendsUnion$1<Inferred>);

type TExtendsImmutable<Left extends TSchema, Right extends TSchema, IsImmutableLeft extends boolean = Left extends TImmutable ? true : false, IsImmutableRight extends boolean = Right extends TImmutable ? true : false, Result extends boolean = [
    IsImmutableLeft,
    IsImmutableRight
] extends [true, true] ? true : [
    IsImmutableLeft,
    IsImmutableRight
] extends [false, true] ? true : [
    IsImmutableLeft,
    IsImmutableRight
] extends [true, false] ? false : true> = Result;
type TExtendsArray<Inferred extends TProperties, ArrayLeft extends TSchema, Left extends TSchema, Right extends TSchema> = (Right extends TArray<infer Type extends TSchema> ? TExtendsImmutable<ArrayLeft, Right> extends true ? TExtendsLeft<Inferred, Left, Type> : TExtendsFalse : TExtendsRight<Inferred, ArrayLeft, Right>);

type TExtendsBigInt<Inferred extends TProperties, Left extends TBigInt, Right extends TSchema> = (Right extends TBigInt ? TExtendsTrue<Inferred> : TExtendsRight<Inferred, Left, Right>);

type TExtendsBoolean<Inferred extends TProperties, Left extends TBoolean, Right extends TSchema> = (Right extends TBoolean ? TExtendsTrue<Inferred> : TExtendsRight<Inferred, Left, Right>);

type TParameterCompare<Inferred extends TProperties, Left extends TSchema, LeftRest extends TSchema[], Right extends TSchema, RightRest extends TSchema[], CheckLeft extends TSchema = Right extends TInfer ? Left : Right, CheckRight extends TSchema = Right extends TInfer ? Right : Left, IsLeftOptional extends boolean = Left extends TOptional ? true : false, IsRightOptional extends boolean = Right extends TOptional ? true : false> = ([
    IsLeftOptional,
    IsRightOptional
] extends [false, true] ? TExtendsFalse : TExtendsLeft<Inferred, CheckLeft, CheckRight> extends TExtendsTrueLike<infer Inferred extends TProperties> ? TExtendsParameters<Inferred, LeftRest, RightRest> : TExtendsFalse);
type TParameterRight<Inferred extends TProperties, Left extends TSchema, LeftRest extends TSchema[], RightRest extends TSchema[]> = (RightRest extends [infer Head extends TSchema, ...infer Tail extends TSchema[]] ? TParameterCompare<Inferred, Left, LeftRest, Head, Tail> : Left extends TOptional ? TExtendsTrue<Inferred> : TExtendsFalse);
type TParameterLeft<Inferred extends TProperties, LeftRest extends TSchema[], RightRest extends TSchema[]> = (LeftRest extends [infer Head extends TSchema, ...infer Tail extends TSchema[]] ? TParameterRight<Inferred, Head, Tail, RightRest> : TExtendsTrue<Inferred>);
type TExtendsParameters<Inferred extends TProperties, Left extends TSchema[], Right extends TSchema[]> = TParameterLeft<Inferred, Left, Right>;

type StaticVoid = void;
/** Represents a Void type. */
interface TVoid extends TSchema {
    '~kind': 'Void';
    type: 'void';
}

type TExtendsReturnType<Inferred extends TProperties, Left extends TSchema, Right extends TSchema> = (Right extends TVoid ? TExtendsTrue<Inferred> : TExtendsLeft<Inferred, Left, Right>);

type TExtendsConstructor<Inferred extends TProperties, Parameters extends TSchema[], InstanceType extends TSchema, Right extends TSchema> = (Right extends TAny ? TExtendsTrue<Inferred> : Right extends TUnknown ? TExtendsTrue<Inferred> : Right extends TConstructor ? TExtendsParameters<Inferred, Parameters, Right['parameters']> extends TExtendsTrueLike<infer Inferred extends TProperties> ? TExtendsReturnType<Inferred, InstanceType, Right['instanceType']> : TExtendsFalse : TExtendsFalse);

type TExtendsDependent<Inferred extends TProperties, If extends TSchema, Then extends TSchema, Else extends TSchema, Right extends TSchema> = (TExtendsLeft<Inferred, If, Right> extends TExtendsTrueLike<infer Inferred extends TProperties> ? TExtendsLeft<Inferred, Then, Right> : TExtendsLeft<Inferred, Else, Right>);

type TExtendsEnum<Inferred extends TProperties, Left extends TEnumValue[], Right extends TSchema, Evaluated extends TSchema = TEvaluateEnum<Left>> = TExtendsLeft<Inferred, Evaluated, Right>;

type TExtendsFunction<Inferred extends TProperties, Parameters extends TSchema[], ReturnType extends TSchema, Right extends TSchema> = (Right extends TAny ? TExtendsTrue<Inferred> : Right extends TUnknown ? TExtendsTrue<Inferred> : Right extends TFunction ? TExtendsParameters<Inferred, Parameters, Right['parameters']> extends TExtendsTrueLike<infer Inferred extends TProperties> ? TExtendsReturnType<Inferred, ReturnType, Right['returnType']> : TExtendsFalse : TExtendsFalse);

type TExtendsInteger<Inferred extends TProperties, Left extends TInteger, Right extends TSchema> = (Right extends TInteger ? TExtendsTrue<Inferred> : Right extends TNumber ? TExtendsTrue<Inferred> : TExtendsRight<Inferred, Left, Right>);

type TExtendsIntersect<Inferred extends TProperties, Left extends TSchema[], Right extends TSchema, Evaluated extends TSchema = TEvaluateIntersect<Left>> = TExtendsLeft<Inferred, Evaluated, Right>;

type TExtendsLiteralValue<Inferred extends TProperties, Left extends TLiteralValue, Right extends TLiteralValue> = (Left extends Right ? TExtendsTrue<Inferred> : TExtendsFalse);
type TExtendsLiteralBigInt<Inferred extends TProperties, Left extends bigint, Right extends TSchema> = (Right extends TLiteral<infer Value extends bigint> ? TExtendsLiteralValue<Inferred, Left, Value> : Right extends TBigInt ? TExtendsTrue<Inferred> : TExtendsRight<Inferred, TLiteral<Left>, Right>);
type TExtendsLiteralBoolean<Inferred extends TProperties, Left extends boolean, Right extends TSchema> = (Right extends TLiteral<infer Value extends boolean> ? TExtendsLiteralValue<Inferred, Left, Value> : Right extends TBoolean ? TExtendsTrue<Inferred> : TExtendsRight<Inferred, TLiteral<Left>, Right>);
type TExtendsLiteralNumber<Inferred extends TProperties, Left extends number, Right extends TSchema> = (Right extends TLiteral<infer Value extends number> ? TExtendsLiteralValue<Inferred, Left, Value> : Right extends TNumber ? TExtendsTrue<Inferred> : TExtendsRight<Inferred, TLiteral<Left>, Right>);
type TExtendsLiteralString<Inferred extends TProperties, Left extends string, Right extends TSchema> = (Right extends TLiteral<infer Value extends string> ? TExtendsLiteralValue<Inferred, Left, Value> : Right extends TString ? TExtendsTrue<Inferred> : TExtendsRight<Inferred, TLiteral<Left>, Right>);
type TExtendsLiteral<Inferred extends TProperties, Left extends TLiteral, Right extends TSchema> = (Left extends TLiteral<infer Value extends bigint> ? TExtendsLiteralBigInt<Inferred, Value, Right> : Left extends TLiteral<infer Value extends boolean> ? TExtendsLiteralBoolean<Inferred, Value, Right> : Left extends TLiteral<infer Value extends number> ? TExtendsLiteralNumber<Inferred, Value, Right> : Left extends TLiteral<infer Value extends string> ? TExtendsLiteralString<Inferred, Value, Right> : TUnreachable);

type TExtendsNever<Inferred extends TProperties, Left extends TNever, Right extends TSchema> = (Right extends TInfer ? TExtendsRight<Inferred, Left, Right> : TExtendsTrue<Inferred>);

type TExtendsNull<Inferred extends TProperties, Left extends TNull, Right extends TSchema> = (Right extends TNull ? TExtendsTrue<Inferred> : TExtendsRight<Inferred, Left, Right>);

type TExtendsNumber<Inferred extends TProperties, Left extends TNumber, Right extends TSchema> = (Right extends TNumber ? TExtendsTrue<Inferred> : TExtendsRight<Inferred, Left, Right>);

type TExtendsPropertyOptional<Inferred extends TProperties, Left extends TSchema, Right extends TSchema> = (Left extends TOptional<Left> ? Right extends TOptional<Right> ? TExtendsTrue<Inferred> : TExtendsFalse : TExtendsTrue<Inferred>);
type TExtendsProperty<Inferred extends TProperties, Left extends TSchema, Right extends TSchema> = (Right extends TInfer<string, TNever> ? TExtendsFalse : TExtendsLeft<Inferred, Left, Right> extends TExtendsTrueLike<infer Inferred extends TProperties> ? TExtendsPropertyOptional<Inferred, Left, Right> : TExtendsFalse);
type TExtractInferredProperties<Keys extends PropertyKey[], Properties extends Record<PropertyKey, TResult>, Result extends TProperties = {}> = (Keys extends [infer Left extends PropertyKey, ...infer Right extends PropertyKey[]] ? Left extends keyof Properties ? Properties[Left] extends Result.TExtendsTrueLike<infer Inferred extends TProperties> ? TExtractInferredProperties<Right, Properties, Result & Inferred> : TExtractInferredProperties<Right, Properties, Result> : TUnreachable : Result);
type TExtendsPropertiesComparer<Inferred extends TProperties, Left extends TProperties, Right extends TProperties, Properties extends Record<PropertyKey, TExtendsTrue | TExtendsFalse> = {
    [RightKey in keyof Right]: (RightKey extends keyof Left ? TExtendsProperty<{}, Left[RightKey], Right[RightKey]> : Right[RightKey] extends TOptional<Right[RightKey]> ? Right[RightKey] extends TInfer ? TExtendsTrue<TAssign<Inferred, {
        [_ in Right[RightKey]['name']]: Right[RightKey]['extends'];
    }>> : TExtendsTrue<Inferred> : TExtendsFalse);
}, Checked extends boolean = Properties[keyof Right] extends TExtendsTrueLike ? true : false, Extracted extends TProperties = Checked extends true ? TExtractInferredProperties<TUnionToTuple<keyof Properties>, Properties> : {}> = (Checked extends true ? TExtendsTrue<Extracted> : TExtendsFalse);
type TExtendsProperties<Inferred extends TProperties, Left extends TProperties, Right extends TProperties, Compared extends TResult = TExtendsPropertiesComparer<Inferred, Left, Right>> = (Compared extends TExtendsTrueLike<infer ComparedInferred extends TProperties> ? TExtendsTrue<TAssign<Inferred, ComparedInferred>> : TExtendsFalse);
type TExtendsObjectToObject<Inferred extends TProperties, Left extends TProperties, Right extends TProperties> = (TExtendsProperties<Inferred, Left, Right>);
type TRecordMergeInferred<Left extends TProperties, Right extends TProperties, Result extends TProperties = {
    [Key in keyof Right]: Key extends keyof Left ? Left[Key] extends TUnion<infer Types extends TSchema[]> ? TUnion<[...Types, Right[Key]]> : TUnion<[Left[Key], Right[Key]]> : Right[Key];
}> = Result;
type TExtendsRecordComparer<Properties extends TProperties, Keys extends (keyof Properties)[], Type extends TSchema, Result extends TProperties> = (Keys extends [infer Left extends (keyof Properties), ...infer Right extends (keyof Properties)[]] ? TExtendsLeft<{}, Properties[Left], Type> extends Result.TExtendsTrueLike<infer Inferred extends TProperties> ? TExtendsRecordComparer<Properties, Right, Type, TRecordMergeInferred<Result, Inferred>> : Result.TExtendsFalse : Result.TExtendsTrue<Result>);
type TExtendsObjectToRecord<Inferred extends TProperties, Properties extends TProperties, _Pattern extends string, Value extends TSchema, Keys extends (keyof Properties)[] = TUnionToTuple<keyof Properties>, Result extends TResult = TExtendsRecordComparer<Properties, Keys, Value, Inferred>> = Result;
type TExtendsObject<Inferred extends TProperties, Left extends TProperties, Right extends TSchema> = (Right extends TRecord<infer Pattern extends string, infer Value extends TSchema> ? TExtendsObjectToRecord<Inferred, Left, Pattern, Value> : Right extends TObject<infer Properties extends TProperties> ? TExtendsObjectToObject<Inferred, Left, Properties> : TExtendsRight<Inferred, TObject<Left>, Right>);

type TFromObject$6<Inferred extends TProperties, Properties extends TProperties> = keyof Properties extends never ? TExtendsTrue<Inferred> : TExtendsFalse;
type TFromRecord$1<Inferred extends TProperties, _LeftKey extends TSchema, LeftValue extends TSchema, _RightKey extends TSchema, RightValue extends TSchema> = (TExtendsLeft<Inferred, LeftValue, RightValue>);
type TExtendsRecord<Inferred extends TProperties, LeftPattern extends string, LeftValue extends TSchema, Right extends TSchema> = (Right extends TRecord<infer Pattern extends string, infer Value extends TSchema> ? TFromRecord$1<Inferred, TRecordPatternToType<LeftPattern>, LeftValue, TRecordPatternToType<Pattern>, Value> : Right extends TObject<infer Properties extends TProperties> ? TFromObject$6<Inferred, Properties> : Right extends TAny ? TExtendsTrue<Inferred> : Right extends TUnknown ? TExtendsTrue<Inferred> : TExtendsFalse);

type TExtendsString<Inferred extends TProperties, Left extends TString, Right extends TSchema> = (Right extends TString ? TExtendsTrue<Inferred> : TExtendsRight<Inferred, Left, Right>);

type TExtendsSymbol<Inferred extends TProperties, Left extends TSymbol, Right extends TSchema> = (Right extends TSymbol ? TExtendsTrue<Inferred> : TExtendsRight<Inferred, Left, Right>);

type TExtendsTemplateLiteral<Inferred extends TProperties, Pattern extends string, Right extends TSchema, Evaluated extends TSchema = TEvaluateTemplateLiteral<Pattern>> = TExtendsLeft<Inferred, Evaluated, Right>;

/** Represents a Rest instruction. */
interface TRest<Type extends TSchema = TSchema> extends TSchema {
    '~kind': 'Rest';
    type: 'rest';
    items: Type;
}

interface TInferable<Name extends string = string, Type extends TSchema = TSchema> {
    '~kind': 'Inferrable';
    name: Name;
    type: Type;
}
type TTryRestInferable<Type extends TSchema, Result extends TInferable | undefined = (Type extends TRest<infer RestType extends TSchema> ? RestType extends TInfer<infer Name extends string, infer Type extends TSchema> ? Type extends TArray<infer Type extends TSchema> ? TInferable<Name, Type> : Type extends TUnknown ? TInferable<Name, Type> : undefined : TUnreachable : undefined)> = Result;
type TTryInferable<Type extends TSchema, Result extends TInferable | undefined = (Type extends TInfer<infer Name extends string, infer Type extends TSchema> ? TInferable<Name, Type> : undefined)> = Result;
type TryInferResults<Rest extends TSchema[], Right extends TSchema, Result extends TSchema[] = []> = (Rest extends [infer Head extends TSchema, ...infer Tail extends TSchema[]] ? TExtendsLeft<{}, Head, Right> extends Result.TExtendsTrueLike ? TryInferResults<Tail, Right, [...Result, Head]> : undefined : Result);
declare function TryInferResults<Rest extends TSchema[], Right extends TSchema>(rest: [...Rest], right: Right, result?: TSchema[]): TryInferResults<Rest, Right>;
type TInferTupleResult<Inferred extends TProperties, Name extends string, Left extends TSchema[], Right extends TSchema, Results extends TSchema[] | undefined = TryInferResults<Left, Right>> = (Results extends [...infer Results extends TSchema[]] ? TExtendsTrue<TAssign<Inferred, {
    [_ in Name]: TTuple<Results>;
}>> : TExtendsFalse);
type TInferUnionResult<Inferred extends TProperties, Name extends string, Left extends TSchema[], Right extends TSchema, Results extends TSchema[] | undefined = TryInferResults<Left, Right>> = (Results extends [...infer Results extends TSchema[]] ? TExtendsTrue<TAssign<Inferred, {
    [_ in Name]: TUnion<Results>;
}>> : TExtendsFalse);

type TReverse<Types extends TSchema[], Result extends TSchema[] = []> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TReverse<Right, [Left, ...Result]> : Result);
type TApplyReverse<Types extends TSchema[], Reversed extends boolean> = Reversed extends true ? TReverse<Types> : Types;
type TReversed<Types extends TSchema[], First extends TSchema | undefined = Types extends [infer Left extends TSchema, ...infer _ extends TSchema[]] ? Left : undefined, Inferable extends TSchema | undefined = First extends TSchema ? TTryRestInferable<First> : undefined, Result extends boolean = Inferable extends TSchema ? true : false> = Result;
type TElementsCompare<Inferred extends TProperties, Reversed extends boolean, Left extends TSchema, LeftRest extends TSchema[], Right extends TSchema, RightRest extends TSchema[]> = (TExtendsLeft<Inferred, Left, Right> extends TExtendsTrueLike<infer CheckInferred extends TProperties> ? TElements<CheckInferred, Reversed, LeftRest, RightRest> : TExtendsFalse);
type TElementsLeft<Inferred extends TProperties, Reversed extends boolean, LeftRest extends TSchema[], Right extends TSchema, RightRest extends TSchema[], Inferable extends TInferable | undefined = TTryRestInferable<Right>> = (Inferable extends TInferable ? TInferTupleResult<Inferred, Inferable['name'], TApplyReverse<LeftRest, Reversed>, Inferable['type']> : LeftRest extends [infer Head extends TSchema, ...infer Tail extends TSchema[]] ? TElementsCompare<Inferred, Reversed, Head, Tail, Right, RightRest> : TExtendsFalse);
type TElementsRight<Inferred extends TProperties, Reversed extends boolean, LeftRest extends TSchema[], RightRest extends TSchema[]> = (RightRest extends [infer Head extends TSchema, ...infer Tail extends TSchema[]] ? TElementsLeft<Inferred, Reversed, LeftRest, Head, Tail> : LeftRest['length'] extends 0 ? TExtendsTrue<Inferred> : TExtendsFalse);
type TElements<Inferred extends TProperties, Reversed extends boolean, LeftRest extends TSchema[], RightRest extends TSchema[]> = TElementsRight<Inferred, Reversed, LeftRest, RightRest>;
type TExtendsTupleToTuple<Inferred extends TProperties, Left extends TSchema[], Right extends TSchema[], InstantiatedRight extends TSchema[] = TInstantiateElements<Inferred, TState<[], []>, Right>, Reversed extends boolean = TReversed<InstantiatedRight>> = TElements<Inferred, Reversed, TApplyReverse<Left, Reversed>, TApplyReverse<InstantiatedRight, Reversed>>;
type TExtendsTupleToArray<Inferred extends TProperties, Left extends TSchema[], Right extends TSchema, Inferrable extends TInferable | undefined = TTryInferable<Right>> = (Inferrable extends TInferable ? TInferUnionResult<Inferred, Inferrable['name'], Left, Inferrable['type']> : Left extends [infer Head extends TSchema, ...infer Tail extends TSchema[]] ? TExtendsLeft<Inferred, Head, Right> extends TExtendsTrueLike<infer Inferred extends TProperties> ? TExtendsTupleToArray<Inferred, Tail, Right> : TExtendsFalse : TExtendsTrue<Inferred>);
type TExtendsTuple<Inferred extends TProperties, Left extends TSchema[], Right extends TSchema, InstantiatedLeft extends TSchema[] = TInstantiateElements<Inferred, TState<[], []>, Left>> = (Right extends TTuple<infer Types extends TSchema[]> ? TExtendsTupleToTuple<Inferred, InstantiatedLeft, Types> : Right extends TArray<infer Type extends TSchema> ? TExtendsTupleToArray<Inferred, InstantiatedLeft, Type> : TExtendsRight<Inferred, TTuple<InstantiatedLeft>, Right>);

type StaticUndefined = undefined;
/** Represents a Undefined type. */
interface TUndefined extends TSchema {
    '~kind': 'Undefined';
    type: 'undefined';
}

type TExtendsUndefined<Inferred extends TProperties, Left extends TUndefined, Right extends TSchema> = (Right extends TVoid ? TExtendsTrue<Inferred> : Right extends TUndefined ? TExtendsTrue<Inferred> : TExtendsRight<Inferred, Left, Right>);

type TExtendsUnionSome<Inferred extends TProperties, Type extends TSchema, UnionTypes extends TSchema[]> = (UnionTypes extends [infer Head extends TSchema, ...infer Tail extends TSchema[]] ? TExtendsLeft<Inferred, Type, Head> extends TExtendsTrueLike<infer Inferred extends TProperties> ? TExtendsTrue<Inferred> : TExtendsUnionSome<Inferred, Type, Tail> : TExtendsFalse);
type TExtendsUnionLeft<Inferred extends TProperties, Left extends TSchema[], Right extends TSchema[]> = (Left extends [infer Head extends TSchema, ...infer Tail extends TSchema[]] ? TExtendsUnionSome<Inferred, Head, Right> extends TExtendsTrueLike<infer Inferred extends TProperties> ? TExtendsUnionLeft<Inferred, Tail, Right> : TExtendsFalse : TExtendsTrue<Inferred>);
type TExtendsUnion<Inferred extends TProperties, Left extends TSchema[], Right extends TSchema, Inferrable extends TInferable | undefined = TTryInferable<Right>> = (Inferrable extends TInferable<infer Name extends string, infer Type extends TSchema> ? TInferUnionResult<Inferred, Name, Left, Type> : Right extends TUnion<infer Types extends TSchema[]> ? TExtendsUnionLeft<Inferred, Left, Types> : TExtendsUnionLeft<Inferred, Left, [Right]>);

type TExtendsUnknown<Inferred extends TProperties, Left extends TUnknown, Right extends TSchema> = (Right extends TInfer ? TExtendsRight<Inferred, Left, Right> : Right extends TAny ? TExtendsTrue<Inferred> : Right extends TUnknown ? TExtendsTrue<Inferred> : TExtendsFalse);

type TExtendsVoid<Inferred extends TProperties, Left extends TVoid, Right extends TSchema> = (Right extends TVoid ? TExtendsTrue<Inferred> : TExtendsRight<Inferred, Left, Right>);

type TExtendsLeft<Inferred extends TProperties, Left extends TSchema, Right extends TSchema> = (Left extends TAny ? TExtendsAny<Inferred, Left, Right> : Left extends TArray<infer Items extends TSchema> ? TExtendsArray<Inferred, Left, Items, Right> : Left extends TBigInt ? TExtendsBigInt<Inferred, Left, Right> : Left extends TBoolean ? TExtendsBoolean<Inferred, Left, Right> : Left extends TConstructor<infer Parameters extends TSchema[], infer InstanceType extends TSchema> ? TExtendsConstructor<Inferred, Parameters, InstanceType, Right> : Left extends TDependent<infer If extends TSchema, infer Then extends TSchema, infer Else extends TSchema> ? TExtendsDependent<Inferred, If, Then, Else, Right> : Left extends TEnum<infer Values extends TEnumValue[]> ? TExtendsEnum<Inferred, Values, Right> : Left extends TFunction<infer Parameters extends TSchema[], infer ReturnType extends TSchema> ? TExtendsFunction<Inferred, Parameters, ReturnType, Right> : Left extends TInteger ? TExtendsInteger<Inferred, Left, Right> : Left extends TIntersect<infer Types extends TSchema[]> ? TExtendsIntersect<Inferred, Types, Right> : Left extends TLiteral ? TExtendsLiteral<Inferred, Left, Right> : Left extends TNever ? TExtendsNever<Inferred, Left, Right> : Left extends TNull ? TExtendsNull<Inferred, Left, Right> : Left extends TNumber ? TExtendsNumber<Inferred, Left, Right> : Left extends TObject<infer Properties extends TProperties> ? TExtendsObject<Inferred, Properties, Right> : Left extends TRecord<infer Pattern extends string, infer Value extends TSchema> ? TExtendsRecord<Inferred, Pattern, Value, Right> : Left extends TString ? TExtendsString<Inferred, Left, Right> : Left extends TSymbol ? TExtendsSymbol<Inferred, Left, Right> : Left extends TTemplateLiteral<infer Pattern extends string> ? TExtendsTemplateLiteral<Inferred, Pattern, Right> : Left extends TTuple<infer Types extends TSchema[]> ? TExtendsTuple<Inferred, Types, Right> : Left extends TUndefined ? TExtendsUndefined<Inferred, Left, Right> : Left extends TUnion<infer Types extends TSchema[]> ? TExtendsUnion<Inferred, Types, Right> : Left extends TUnknown ? TExtendsUnknown<Inferred, Left, Right> : Left extends TVoid ? TExtendsVoid<Inferred, Left, Right> : TExtendsFalse);

type TInterfaceOperation<Heritage extends TSchema[], Properties extends TProperties, Result extends TSchema = TEvaluateIntersect<[...Heritage, TObject<Properties>]>> = Result;
type TInterfaceAction<Heritage extends TSchema[], Properties extends TProperties, Result extends TSchema = TCanInstantiate<Heritage> extends true ? TInterfaceOperation<Heritage, Properties> : TInterfaceDeferred<Heritage, Properties>> = Result;
type TInterfaceInstantiate<Context extends TProperties, State extends TState, Heritage extends TSchema[], Properties extends TProperties, InstantiatedHeritage extends TSchema[] = TInstantiateTypes<Context, State, Heritage>, InstantiatedProperties extends TProperties = TInstantiateProperties<Context, State, Properties>> = TInterfaceAction<InstantiatedHeritage, InstantiatedProperties>;

/** Creates a deferred Interface action. */
type TInterfaceDeferred<Heritage extends TSchema[] = TSchema[], Properties extends TProperties = TProperties> = (TDeferred<'Interface', [Heritage, Properties]>);

type TFromRef$3<Stack extends (keyof Context)[], Context extends TProperties, Ref extends (keyof Context)> = Ref extends Stack[number] ? true : TFromType$h<[...Stack, Ref], Context, Context[Ref]>;
type TFromProperties$2<Stack extends (keyof Context)[], Context extends TProperties, Properties extends TProperties, Types extends TSchema[] = TPropertyValues<Properties>> = TFromTypes$4<Stack, Context, Types>;
type TFromTypes$4<Stack extends (keyof Context)[], Context extends TProperties, Types extends TSchema[]> = Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TFromType$h<Stack, Context, Left> extends true ? true : TFromTypes$4<Stack, Context, Right> : false;
type TFromType$h<Stack extends (keyof Context)[], Context extends TProperties, Type extends TSchema> = (Type extends TRef<infer Ref extends string> ? TFromRef$3<Stack, Context, Ref> : Type extends TArray<infer Type extends TSchema> ? TFromType$h<Stack, Context, Type> : Type extends TConstructor<infer Parameters extends TSchema[], infer InstanceType extends TSchema> ? TFromTypes$4<Stack, Context, [...Parameters, InstanceType]> : Type extends TFunction<infer Parameters extends TSchema[], infer ReturnType extends TSchema> ? TFromTypes$4<Stack, Context, [...Parameters, ReturnType]> : Type extends TInterfaceDeferred<TSchema[], infer Properties extends TProperties> ? TFromProperties$2<Stack, Context, Properties> : Type extends TIntersect<infer Types extends TSchema[]> ? TFromTypes$4<Stack, Context, Types> : Type extends TObject<infer Properties extends TProperties> ? TFromProperties$2<Stack, Context, Properties> : Type extends TUnion<infer Types extends TSchema[]> ? TFromTypes$4<Stack, Context, Types> : Type extends TTuple<infer Types extends TSchema[]> ? TFromTypes$4<Stack, Context, Types> : Type extends TRecord<string, infer Type extends TSchema> ? TFromType$h<Stack, Context, Type> : false);
/** Performs a cyclic check on the given type. Initial key stack can be empty, but faster if specified */
type TCyclicCheck<Stack extends (keyof Context)[], Context extends TProperties, Type extends TSchema, Result extends boolean = TFromType$h<Stack, Context, Type>> = Result;

type TResolveCandidateKeys<Context extends TProperties, Keys extends (keyof Context)[], Result extends (keyof Context)[] = []> = (Keys extends [infer Left extends keyof Context, ...infer Right extends (keyof Context)[]] ? TCyclicCheck<[Left], Context, Context[Left]> extends true ? TResolveCandidateKeys<Context, Right, [...Result, Left]> : TResolveCandidateKeys<Context, Right, Result> : Result);
/** Returns keys for context types that need to be transformed to TCyclic. */
type TCyclicCandidates<Context extends TProperties, Keys extends (keyof Context)[] = TPropertyKeys<Context>, Result extends (keyof Context)[] = TResolveCandidateKeys<Context, Keys>> = Result;

type TFromRef$2<Context extends TProperties, Ref extends string, Dependencies extends string[]> = Ref extends Dependencies[number] ? Dependencies : Ref extends keyof Context ? TFromType$g<Context, Context[Ref], [...Dependencies, Ref]> : TUnreachable;
type TFromProperties$1<Context extends TProperties, Properties extends TProperties, Dependencies extends string[], Types extends TSchema[] = TPropertyValues<Properties>> = TFromTypes$3<Context, Types, Dependencies>;
type TFromTypes$3<Context extends TProperties, Types extends TSchema[], Dependencies extends string[]> = Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TFromTypes$3<Context, Right, TFromType$g<Context, Left, Dependencies>> : Dependencies;
type TFromType$g<Context extends TProperties, Type extends TSchema, Result extends string[]> = (Type extends TRef<infer Ref extends string> ? TFromRef$2<Context, Ref, Result> : Type extends TArray<infer Type extends TSchema> ? TFromType$g<Context, Type, Result> : Type extends TConstructor<infer Parameters extends TSchema[], infer InstanceType extends TSchema> ? TFromTypes$3<Context, [...Parameters, InstanceType], Result> : Type extends TFunction<infer Parameters extends TSchema[], infer ReturnType extends TSchema> ? TFromTypes$3<Context, [...Parameters, ReturnType], Result> : Type extends TInterfaceDeferred<TSchema[], infer Properties extends TProperties> ? TFromProperties$1<Context, Properties, Result> : Type extends TIntersect<infer Types extends TSchema[]> ? TFromTypes$3<Context, Types, Result> : Type extends TObject<infer Properties extends TProperties> ? TFromProperties$1<Context, Properties, Result> : Type extends TUnion<infer Types extends TSchema[]> ? TFromTypes$3<Context, Types, Result> : Type extends TTuple<infer Types extends TSchema[]> ? TFromTypes$3<Context, Types, Result> : Type extends TRecord<string, infer Type extends TSchema> ? TFromType$g<Context, Type, Result> : Result);
/** Returns dependent cyclic keys for the given type. This function is used to dead-type-eliminate (DTE) for initializing TCyclic types. */
type TCyclicDependencies<Context extends TProperties, Key extends string, Type extends TSchema, Result extends string[] = TFromType$g<Context, Type, [Key]>> = Result;

type TFromRef$1<_Ref extends string> = (TAny);
type TFromProperties<Properties extends TProperties, Result extends TProperties = {
    [Key in keyof Properties]: TFromType$f<Properties[Key]>;
}> = {
    [Key in keyof Result]: Result[Key];
};
type TFromTypes$2<Types extends TSchema[], Result extends TSchema[] = []> = Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TFromTypes$2<Right, [...Result, TFromType$f<Left>]> : Result;
type TFromType$f<Type extends TSchema> = (Type extends TRef<infer Ref extends string> ? TFromRef$1<Ref> : Type extends TArray<infer Type extends TSchema> ? TArray<TFromType$f<Type>> : Type extends TConstructor<infer Parameters extends TSchema[], infer InstanceType extends TSchema> ? TFunction<TFromTypes$2<Parameters>, TFromType$f<InstanceType>> : Type extends TFunction<infer Parameters extends TSchema[], infer ReturnType extends TSchema> ? TFunction<TFromTypes$2<Parameters>, TFromType$f<ReturnType>> : Type extends TIntersect<infer Types extends TSchema[]> ? TIntersect<TFromTypes$2<Types>> : Type extends TObject<infer Properties extends TProperties> ? TObject<TFromProperties<Properties>> : Type extends TRecord<infer Pattern extends string, infer Value extends TSchema> ? TRecord<Pattern, TFromType$f<Value>> : Type extends TUnion<infer Types extends TSchema[]> ? TUnion<TFromTypes$2<Types>> : Type extends TTuple<infer Types extends TSchema[]> ? TTuple<TFromTypes$2<Types>> : Type);
type TCyclicAnyFromParameters<Defs extends TProperties, Ref extends string> = (Ref extends keyof Defs ? TFromType$f<Defs[Ref]> : TUnknown);
/** Transforms TCyclic TRef's into TAny's. This function is used prior to TExtends checks to enable cyclics to be structurally checked and terminated (with TAny) at first point of recursion, what would otherwise be a recursive TRef.*/
type TCyclicExtends<Type extends TCyclic, Result extends TSchema = TCyclicAnyFromParameters<Type['$defs'], Type['$ref']>> = Result;

type TCyclicInterface<Context extends TProperties, Heritage extends TSchema[], Properties extends TProperties, InstantiatedHeritage extends TSchema[] = TInstantiateTypes<Context, TState<[], []>, Heritage>, instantiatedProperties extends TProperties = TInstantiateProperties<{}, TState<[], []>, Properties>, EvaluatedInterface extends TSchema = TEvaluateIntersect<[...InstantiatedHeritage, TObject<instantiatedProperties>]>> = EvaluatedInterface;
type TCyclicDefinitions<Context extends TProperties, Dependencies extends string[], Result extends TProperties = {
    [Key in Extract<keyof Context, Dependencies[number]>]: Context[Key] extends TInterfaceDeferred<infer Heritage extends TSchema[], infer Properties extends TProperties> ? TCyclicInterface<Context, Heritage, Properties> : Context[Key];
}> = Result;
type TInstantiateCyclic<Context extends TProperties, Ref extends string, Type extends TSchema, Dependencies extends string[] = TCyclicDependencies<Context, Ref, Type>, Definitions extends TProperties = TCyclicDefinitions<Context, Dependencies>, Result extends TSchema = TCyclic<Definitions, Ref>> = Result;

type TResolve$1<Defs extends TProperties, Ref extends string> = (Ref extends keyof Defs ? Defs[Ref] extends TRef<infer Ref extends string> ? TResolve$1<Defs, Ref> : Defs[Ref] : TNever);
/** Returns the target Type from the Defs or Never if target is non-resolvable */
type TCyclicTarget<Defs extends TProperties, Ref extends string, Result extends TSchema = TResolve$1<Defs, Ref>> = Result;

type TCanonical<Type extends TSchema> = (Type extends TCyclic ? TCyclicExtends<Type> : Type extends TUnsafe ? TUnknown : Type);
/** Performs a structural extends check on left and right types and yields inferred types on right if specified. */
type TExtends<Inferred extends TProperties, Left extends TSchema, Right extends TSchema, CanonicalLeft extends TSchema = TCanonical<Left>, CanonicalRight extends TSchema = TCanonical<Right>> = TExtendsLeft<Inferred, CanonicalLeft, CanonicalRight>;

type TExcludeType<Left extends TSchema, Right extends TSchema, Check extends TResult = TExtends<{}, Left, Right>, Result extends TSchema[] = Check extends TExtendsTrueLike ? [] : [Left]> = Result;
type TExcludeUnion<Left extends TSchema[], Right extends TSchema, Result extends TSchema[] = []> = (Left extends [infer Head extends TSchema, ...infer Tail extends TSchema[]] ? TExcludeUnion<Tail, Right, [...Result, ...TExcludeType<Head, Right>]> : Result);
type TExcludeOperation<Left extends TSchema, Right extends TSchema, Evaluated extends TSchema = TEvaluateType<Left>, Canonical extends TSchema[] = Evaluated extends TUnion<infer Types extends TSchema[]> ? Types : [Evaluated], Remaining extends TSchema[] = TExcludeUnion<Canonical, Right>, Result extends TSchema = TEvaluateUnion<Remaining>> = Result;

type TEvaluateDependent<If extends TSchema, Then extends TSchema, Else extends TSchema, Intersected extends TSchema = TEvaluateIntersect<[If, Then]>, Excluded extends TSchema = TExcludeOperation<Else, If>, Result extends TSchema = TEvaluateUnion<[Intersected, Excluded]>> = Result;
type TEvaluateEnum<Values extends TEnumValue[], Result extends TSchema[] = []> = (Values extends [infer Left extends TEnumValue, ...infer Right extends TEnumValue[]] ? TEvaluateEnum<Right, [...Result, TLiteral<Left>]> : TEvaluateUnion<Result>);
type TEvaluateIntersect<Types extends TSchema[], Distribution extends TSchema[] = TDistribute$1<Types>, Broadend extends TSchema[] = TBroaden<Distribution>, Result extends TSchema = TEvaluateUnion<Broadend>> = Result;
type TEvaluateTemplateLiteral<Pattern extends string, Evaluated extends TSchema = TTemplateLiteralDecode<Pattern>, Result extends TSchema = TEvaluateType<Evaluated>> = Result;
type TEvaluateUnion<Types extends TSchema[], Broadend extends TSchema[] = TBroaden<Types>, Result extends TSchema = TEvaluateUnionFast<Broadend>> = Result;
type TEvaluateType<Type extends TSchema, Result extends TSchema = (Type extends TDependent<infer If extends TSchema, infer Then extends TSchema, infer Else extends TSchema> ? TEvaluateDependent<If, Then, Else> : Type extends TEnum<infer Values extends TEnumValue[]> ? TEvaluateEnum<Values> : Type extends TIntersect<infer Types extends TSchema[]> ? TEvaluateIntersect<Types> : Type extends TTemplateLiteral<infer Pattern extends string> ? TEvaluateTemplateLiteral<Pattern> : Type extends TUnion<infer Types extends TSchema[]> ? TEvaluateUnion<Types> : Type)> = Result;
type TEvaluateUnionFast<Types extends TSchema[], Result extends TSchema = (Types extends [infer Type extends TSchema] ? Type : Types extends [] ? TNever : TUnion<Types>)> = Result;

type TJoinString<Input extends string[], Result extends string = ''> = (Input extends [infer Left extends string, ...infer Right extends string[]] ? Result extends '' ? TJoinString<Right, Left> : TJoinString<Right, `${Result}|${Left}`> : Result);
type TUnwrapTemplateLiteralPattern<Pattern extends string> = (Pattern extends `^${infer Pattern extends string}$` ? Pattern : never);
type TEncodeLiteral<Value extends TLiteralValue, Right extends TSchema[], Pattern extends string> = (TEncodeTypes<Right, `${Pattern}${Value}`>);
type TEncodeBigInt<Right extends TSchema[], Pattern extends string> = (TEncodeTypes<Right, `${Pattern}${typeof BigIntPattern}`>);
type TEncodeInteger<Right extends TSchema[], Pattern extends string> = (TEncodeTypes<Right, `${Pattern}${typeof IntegerPattern}`>);
type TEncodeNumber<Right extends TSchema[], Pattern extends string> = (TEncodeTypes<Right, `${Pattern}${typeof NumberPattern}`>);
type TEncodeBoolean<Right extends TSchema[], Pattern extends string> = (TEncodeType<TUnion<[TLiteral<'false'>, TLiteral<'true'>]>, Right, Pattern>);
type TEncodeString<Right extends TSchema[], Pattern extends string> = (TEncodeTypes<Right, `${Pattern}${typeof StringPattern}`>);
type TEncodeTemplateLiteral<TemplatePattern extends string, Right extends TSchema[], Pattern extends string> = (TEncodeTypes<Right, `${Pattern}${TUnwrapTemplateLiteralPattern<TemplatePattern>}`>);
type TEncodeTemplateLiteralDeferred<Types extends TSchema[], Right extends TSchema[], Pattern extends string, TemplateLiteral extends TSchema = TTemplateLiteralAction<Types>, Result extends TSchema = TEncodeType<TemplateLiteral, Right, Pattern>> = Result;
type TEncodeEnum<Values extends TEnumValue[], Right extends TSchema[], Pattern extends string, Evaluated extends TSchema = TEvaluateEnum<Values>> = TEncodeType<Evaluated, Right, Pattern>;
type TEncodeUnion<Types extends TSchema[], Right extends TSchema[], Pattern extends string, Result extends string[] = []> = Types extends [infer Head extends TSchema, ...infer Tail extends TSchema[]] ? TEncodeUnion<Tail, Right, Pattern, [...Result, TEncodeType<Head, [], ''>]> : TEncodeTypes<Right, `${Pattern}(${TJoinString<Result>})`>;
type TEncodeType<Type extends TSchema, Right extends TSchema[], Pattern extends string> = (Type extends TEnum<infer Values extends TEnumValue[]> ? TEncodeEnum<Values, Right, Pattern> : Type extends TInteger ? TEncodeInteger<Right, Pattern> : Type extends TLiteral<infer Value extends TLiteralValue> ? TEncodeLiteral<Value, Right, Pattern> : Type extends TBigInt ? TEncodeBigInt<Right, Pattern> : Type extends TBoolean ? TEncodeBoolean<Right, Pattern> : Type extends TNumber ? TEncodeNumber<Right, Pattern> : Type extends TString ? TEncodeString<Right, Pattern> : Type extends TTemplateLiteral<infer TemplatePattern extends string> ? TEncodeTemplateLiteral<TemplatePattern, Right, Pattern> : Type extends TTemplateLiteralDeferred<infer Types extends TSchema[]> ? TEncodeTemplateLiteralDeferred<Types, Right, Pattern> : Type extends TUnion<infer Types extends TSchema[]> ? TEncodeUnion<Types, Right, Pattern> : typeof NeverPattern);
type TEncodeTypes<Types extends TSchema[], Pattern extends string> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TEncodeType<Left, Right, Pattern> : Pattern);
type TEncodePattern<Types extends TSchema[], Encoded extends string = TEncodeTypes<Types, ''>, Result extends string = `^${Encoded}$`> = Result;
/** Encodes a TemplateLiteral type sequence into a TemplateLiteral */
type TTemplateLiteralEncode<Types extends TSchema[], Pattern extends string = TEncodePattern<Types>, Result extends TSchema = TTemplateLiteral<Pattern>> = Result;

type TTemplateLiteralAction<Types extends TSchema[], Result extends TSchema = TCanInstantiate<Types> extends true ? TTemplateLiteralEncode<Types> : TTemplateLiteralDeferred<Types>> = Result;
type TTemplateLiteralInstantiate<Context extends TProperties, State extends TState, Types extends TSchema[], InstantiatedTypes extends TSchema[] = TInstantiateTypes<Context, State, Types>> = TTemplateLiteralAction<InstantiatedTypes>;

type StaticTemplateLiteral<Pattern extends string> = (TTemplateLiteralStatic<Pattern>);
/** Represents a TemplateLiteral type. */
interface TTemplateLiteral<Pattern extends string = string> extends TSchema {
    '~kind': 'TemplateLiteral';
    type: 'string';
    pattern: Pattern;
}
/** Creates a deferred TemplateLiteral action. */
type TTemplateLiteralDeferred<Types extends TSchema[] = TSchema[]> = (TDeferred<'TemplateLiteral', [Types]>);

type TFromLiteral$4<_Value extends TLiteralValue> = true;
type TFromTypesReduce<Types extends TSchema[]> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TFromType$e<Left> extends true ? TFromTypesReduce<Right> : false : true);
type TFromTypes$1<Types extends TSchema[], Result extends boolean = Types extends [] ? false : TFromTypesReduce<Types>> = Result;
type TFromType$e<Type extends TSchema> = Type extends TUnion<infer Types extends TSchema[]> ? TFromTypes$1<Types> : Type extends TLiteral<infer Value extends TLiteralValue> ? TFromLiteral$4<Value> : false;
/** Returns true if the given TemplateLiteral types yields a finite variant set */
type TIsTemplateLiteralFinite<Types extends TSchema[], Result extends boolean = TFromTypes$1<Types>> = Result;

type TFromLiteralPush<Variants extends string[], Value extends TLiteralValue, Result extends string[] = []> = Variants extends [infer Left extends string, ...infer Right extends string[]] ? TFromLiteralPush<Right, Value, [...Result, `${Left}${Value}`]> : Result;
type TFromLiteral$3<Variants extends string[], Value extends TLiteralValue> = Variants extends [] ? [`${Value}`] : TFromLiteralPush<Variants, Value>;
type TFromUnion$7<Variants extends string[], Types extends TSchema[], Result extends string[] = []> = Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TFromUnion$7<Variants, Right, [...Result, ...TFromType$d<Variants, Left>]> : Result;
type TFromType$d<Variants extends string[], Type extends TSchema, Result extends string[] = (Type extends TUnion<infer Types extends TSchema[]> ? TFromUnion$7<Variants, Types> : Type extends TLiteral<infer Value extends TLiteralValue> ? TFromLiteral$3<Variants, Value> : TUnreachable)> = Result;
type TDecodeFromSpan<Variants extends string[], Types extends TSchema[]> = Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TDecodeFromSpan<TFromType$d<Variants, Left>, Right> : Variants;
type TVariantsToLiterals<Variants extends string[], Result extends TSchema[] = []> = Variants extends [infer Left extends string, ...infer Right extends string[]] ? TVariantsToLiterals<Right, [...Result, TLiteral<Left>]> : Result;
type TDecodeTypesAsUnion<Types extends TSchema[], Variants extends string[] = TDecodeFromSpan<[], Types>, Literals extends TSchema[] = TVariantsToLiterals<Variants>, Result extends TSchema = TUnion<Literals>> = Result;
type TDecodeTypes<Types extends TSchema[], Result extends TSchema = (Types extends [] ? TUnreachable : Types extends [infer Type extends TLiteral] ? Type : TDecodeTypesAsUnion<Types>)> = Result;
/** Decodes a TemplateLiteral into a Type. */
type TTemplateLiteralDecodeUnsafe<Pattern extends string, Types extends TSchema[] = TParsePatternIntoTypes<Pattern>, Result extends TSchema = (Types extends [] ? TString : TIsTemplateLiteralFinite<Types> extends true ? TDecodeTypes<Types> : TTemplateLiteral<Pattern>)> = Result;
/** Decodes a TemplateLiteral pattern but returns TString if the pattern in non-finite. */
type TTemplateLiteralDecode<Pattern extends string, Decoded extends TSchema = TTemplateLiteralDecodeUnsafe<Pattern>, Result extends TSchema = Decoded extends TTemplateLiteral ? TString : Decoded> = Result;

type TFromAnyKey<Value extends TSchema, Result extends TSchema = TRecord<typeof StringKey, Value>> = Result;

type TFromBooleanKey<Value extends TSchema, Result extends TSchema = TObject<{
    true: Value;
    false: Value;
}>> = Result;

type TFromEnumKey<Values extends TEnumValue[], Value extends TSchema, UnionKey extends TSchema = TEvaluateEnum<Values>, Result extends TSchema = TFromKey<UnionKey, Value>> = Result;

type TFromIntegerKey<_Key extends TInteger, Value extends TSchema, Result extends TSchema = TRecord<typeof IntegerKey, Value>> = Result;

type TFromIntersectKey<Types extends TSchema[], Value extends TSchema, EvaluatedKey extends TSchema = TEvaluateIntersect<Types>, Result extends TSchema = TFromKey<EvaluatedKey, Value>> = Result;

type TFromLiteralKey<Key extends TLiteralValue, Value extends TSchema, Result extends TSchema = (Key extends string | number ? TObject<{
    [_ in Key]: Value;
}> : Key extends false ? TObject<{
    false: Value;
}> : Key extends true ? TObject<{
    true: Value;
}> : TObject<{}>)> = Result;

type TFromNumberKey<Key extends TNumber, Value extends TSchema, Result extends TSchema = TRecord<typeof NumberKey, Value>> = Result;

type TFromStringKey<_Key extends TSchema, Value extends TSchema, Result extends TSchema = TRecord<typeof StringKey, Value>> = Result;

type TFromTemplateKey<Pattern extends string, Value extends TSchema, Types extends TSchema[] = TParsePatternIntoTypes<Pattern>, Finite extends boolean = TIsTemplateLiteralFinite<Types>, Result extends TSchema = Finite extends true ? TFromKey<TEvaluateTemplateLiteral<Pattern>, Value> : TRecord<Pattern, Value>> = Result;

type TFlattenType<Type extends TSchema, Result extends TSchema[] = Type extends TUnion<infer Types extends TSchema[]> ? TFlatten<Types> : [Type]> = Result;
type TFlatten<Types extends TSchema[], Result extends TSchema[] = []> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TFlatten<Right, [...Result, ...TFlattenType<Left>]> : Result);

type TStringOrNumberCheck<Types extends TSchema[]> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? Left extends TString | TNumber | TInteger ? true : TStringOrNumberCheck<Right> : false);
type TTryBuildRecord<Types extends TSchema[], Value extends TSchema, Result extends TSchema | undefined = (TStringOrNumberCheck<Types> extends true ? TRecord<typeof StringKey, Value> : undefined)> = Result;
type TCreateProperties<Variants extends TSchema[], Value extends TSchema, Result extends TProperties = {}> = (Variants extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? Left extends TLiteral<string | number> ? TCreateProperties<Right, Value, Result & {
    [_ in Left['const']]: Value;
}> : TCreateProperties<Right, Value, Result> : {
    [Key in keyof Result]: Result[Key];
});
type TCreateObject<Variants extends TSchema[], Value extends TSchema, Properties extends TProperties = TCreateProperties<Variants, Value>, Result extends TSchema = TObject<Properties>> = Result;
type TFromUnionKey<Types extends TSchema[], Value extends TSchema, Flattened extends TSchema[] = TFlatten<Types>, Record extends TSchema | undefined = TTryBuildRecord<Flattened, Value>, Result extends TSchema = (Record extends TSchema ? Record : TCreateObject<Flattened, Value>)> = Result;

type TFromKey<Key extends TSchema, Value extends TSchema, Result extends TSchema = (Key extends TAny ? TFromAnyKey<Value> : Key extends TBoolean ? TFromBooleanKey<Value> : Key extends TEnum<infer Values extends TEnumValue[]> ? TFromEnumKey<Values, Value> : Key extends TInteger ? TFromIntegerKey<Key, Value> : Key extends TIntersect<infer Types extends TSchema[]> ? TFromIntersectKey<Types, Value> : Key extends TLiteral<infer LiteralValue extends TLiteralValue> ? TFromLiteralKey<LiteralValue, Value> : Key extends TNumber ? TFromNumberKey<Key, Value> : Key extends TString ? TFromStringKey<Key, Value> : Key extends TTemplateLiteral<infer Pattern extends string> ? TFromTemplateKey<Pattern, Value> : Key extends TUnion<infer Types extends TSchema[]> ? TFromUnionKey<Types, Value> : TObject<{}>)> = Result;

type TRecordAction<Key extends TSchema, Value extends TSchema, Result extends TSchema = TCanInstantiate<[Key]> extends true ? TFromKey<Key, Value> : TRecordDeferred<Key, Value>> = Result;
type TRecordInstantiate<Context extends TProperties, State extends TState, Key extends TSchema, Value extends TSchema, InstantiatedKey extends TSchema = TInstantiateType<Context, State, Key>, InstantiatedValue extends TSchema = TInstantiateType<Context, State, Value>> = TRecordAction<InstantiatedKey, InstantiatedValue>;

type StaticPropertyKey<Key extends string, Result extends PropertyKey = (Key extends TStringKey ? string : Key extends TIntegerKey ? number : Key extends TNumberKey ? number : Key extends `^${string}$` ? TTemplateLiteralStatic<Key> : string)> = Result;
type StaticRecord<Stack extends string[], Direction extends StaticDirection, Context extends TProperties, This extends TProperties, Key extends string, Value extends TSchema, StaticKey extends PropertyKey = StaticPropertyKey<Key>, StaticValue extends unknown = StaticType<Stack, Direction, Context, This, Value>, Result extends Record$1<PropertyKey, unknown> = Record$1<StaticKey, StaticValue>> = Result;
type TStringKey = typeof StringKey;
type TIntegerKey = typeof IntegerKey;
type TNumberKey = typeof NumberKey;
declare const IntegerKey = "^-?(?:0|[1-9][0-9]*)$";
declare const NumberKey = "^-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$";
declare const StringKey = "^.*$";
interface TRecord<Key extends string = string, Value extends TSchema = TSchema> extends TSchema {
    '~kind': 'Record';
    type: 'object';
    patternProperties: {
        [_ in Key]: Value;
    };
}
/** Represents a deferred Record action. */
type TRecordDeferred<Key extends TSchema = TSchema, Value extends TSchema = TSchema> = (TDeferred<'Record', [Key, Value]>);
/** Creates a Record type. */
declare function Record$1<Key extends TSchema, Value extends TSchema>(key: Key, value: Value, options?: TObjectOptions): TRecordAction<Key, Value>;
/** Transforms a Record Pattern to a Type */
type TRecordPatternToType<Pattern extends string, Result extends TSchema = (Pattern extends typeof StringKey ? TString : Pattern extends typeof IntegerKey ? TInteger : Pattern extends typeof NumberKey ? TNumber : TTemplateLiteralDecodeUnsafe<Pattern>)> = Result;
/** Extracts the Pattern from a Record type */
type TRecordPattern<Type extends TRecord, Result extends string = Extract<keyof Type['patternProperties'], string>> = Result;
/** Extracts the Key from a Record type */
type TRecordKey<Type extends TRecord, Pattern extends string = TRecordPattern<Type>, Result extends TSchema = TRecordPatternToType<Pattern>> = Result;

type StaticThis<Stack extends string[], Direction extends StaticDirection, Context extends TProperties, This extends TProperties> = (StaticType<Stack, Direction, Context, This, TObject<This>>);
/** Represents a This type. */
interface TThis extends TSchema {
    '~kind': 'This';
    $ref: '#';
}

declare const CompareResultEqual = 0;
declare const CompareResultDisjoint = 1;
declare const CompareResultLeftInside = 2;
declare const CompareResultRightInside = 3;
type TCompareResult = (typeof CompareResultEqual | typeof CompareResultDisjoint | typeof CompareResultLeftInside | typeof CompareResultRightInside);
/** Compares left and right types and determines their set relationship */
type TCompare<Left extends TSchema, Right extends TSchema, Extends extends [TResult, TResult] = [TExtends<{}, Left, Right>, TExtends<{}, Right, Left>]> = (Extends extends [TExtendsTrueLike, TExtendsTrueLike] ? typeof CompareResultEqual : Extends extends [TExtendsTrueLike, TExtendsFalse] ? typeof CompareResultLeftInside : Extends extends [TExtendsFalse, TExtendsTrueLike] ? typeof CompareResultRightInside : typeof CompareResultDisjoint);

type TBroadenFilter<Type extends TSchema, Types extends TSchema[], Result extends TSchema[] = [], All extends TSchema[] = Types> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TCompare<Type, Left> extends typeof CompareResultLeftInside | typeof CompareResultEqual ? All : TCompare<Type, Left> extends typeof CompareResultDisjoint ? TBroadenFilter<Type, Right, [...Result, Left], All> : TBroadenFilter<Type, Right, Result, All> : [...Result, Type]);
type TBroadenType<Type extends TSchema, Types extends TSchema[], Result extends TSchema[], Evaluated extends TSchema = TEvaluateType<Type>> = (Evaluated extends TAny ? [Evaluated] : Evaluated extends TUnknown ? [Evaluated] : Evaluated extends TNever ? TBroadenTypes<Types, Result> : Evaluated extends TObject ? TBroadenTypes<Types, [...Result, Evaluated]> : TBroadenTypes<Types, TBroadenFilter<Evaluated, Result>>);
type TBroadenTypes<Types extends TSchema[], Result extends TSchema[] = []> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TBroadenType<Left, Right, Result> : Result);
type TBroaden<Types extends TSchema[], Broadened extends TSchema[] = TBroadenTypes<Types>, Flattened extends TSchema[] = TFlatten<Broadened>> = Flattened;

type TEvaluateAction<Type extends TSchema, Result extends TSchema = TEvaluateType<Type>> = Result;
type TEvaluateInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, InstantiatedType extends TSchema = TInstantiateType<Context, State, Type>> = TEvaluateAction<InstantiatedType>;

type TCollectDistributionNames<Expression extends TSchema, Result extends string[] = []> = (Expression extends TDeferred<'Conditional', [infer Left extends TSchema, infer _Right extends TSchema, infer True extends TSchema, infer False extends TSchema]> ? Left extends TRef ? TCollectDistributionNames<True, TCollectDistributionNames<False, [...Result, Left['$ref']]>> : TCollectDistributionNames<True, TCollectDistributionNames<False, Result>> : Expression extends TDeferred<'Mapped', [infer _Identifier extends TSchema, infer Type extends TSchema, infer _As extends TSchema, infer _Property extends TSchema]> ? (Type extends TDeferred<'KeyOf', [infer Ref extends TRef]> ? [...Result, Ref['$ref']] : Result) : Result);
type TBuildDistributionArray<Parameters extends TParameter[], Names extends string[], Result extends boolean[] = []> = (Parameters extends [infer Left extends TParameter, ...infer Right extends TParameter[]] ? Left['name'] extends Names[number] ? TBuildDistributionArray<Right, Names, [...Result, true]> : TBuildDistributionArray<Right, Names, [...Result, false]> : Result);
type TZipDistributionArray<Arguments extends TSchema[], DistributionArray extends boolean[], Result extends [boolean, TSchema][] = []> = (Arguments extends [infer ArgumentLeft extends TSchema, ...infer ArgumentRight extends TSchema[]] ? DistributionArray extends [infer BooleanLeft extends boolean, ...infer BooleanRight extends boolean[]] ? TZipDistributionArray<ArgumentRight, BooleanRight, [...Result, [BooleanLeft, ArgumentLeft]]> : Result : Result);
type TCanonicalArgument<Type extends TSchema> = (Type extends TTemplateLiteral<infer Pattern extends string> ? TEvaluateTemplateLiteral<Pattern> : Type extends TEnum<infer Values extends TEnumValue[]> ? TEvaluateEnum<Values> : Type);
type TExpand<Argument extends TSchema, CanonicalArgument extends TSchema = TCanonicalArgument<Argument>> = (CanonicalArgument extends TUnion<infer Types extends TSchema[]> ? [...Types] : [CanonicalArgument]);
type TAppend<Current extends TSchema[][], Type extends TSchema, Result extends TSchema[][] = []> = (Current extends [infer Left extends TSchema[], ...infer Right extends TSchema[][]] ? TAppend<Right, Type, [...Result, [...Left, Type]]> : Result);
type TCross<Current extends TSchema[][], Variants extends TSchema[], Result extends TSchema[][] = []> = (Variants extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TCross<Current, Right, [...Result, ...TAppend<Current, Left>]> : Result);
type TDistribute<ZippedArguments extends [boolean, TSchema][], Result extends TSchema[][] = [[]]> = (ZippedArguments extends [infer Left extends [boolean, TSchema], ...infer Right extends [boolean, TSchema][]] ? Left[0] extends true ? TDistribute<Right, TCross<Result, TExpand<Left[1]>>> : TDistribute<Right, TCross<Result, [Left[1]]>> : Result);
type TDistributeArguments<Parameters extends TParameter[], Arguments extends TSchema[], Expression extends TSchema, DistributionNames extends string[] = TCollectDistributionNames<Expression>, DistributionArray extends boolean[] = TBuildDistributionArray<Parameters, DistributionNames>, ZippedArguments extends [boolean, TSchema][] = TZipDistributionArray<Arguments, DistributionArray>, Result extends TSchema[][] = (Expression extends TDeferred<'Conditional', TSchema[]> ? TDistribute<ZippedArguments> : Expression extends TDeferred<'Mapped', TSchema[]> ? TDistribute<ZippedArguments> : [Arguments])> = Result;

type TFromNotResolvable = ([
    '(not-resolvable)',
    TNever
]);
type TFromNotGeneric = ([
    '(not-generic)',
    TNever
]);
type TFromGeneric<Name extends string, Parameters extends TParameter[], Expression extends TSchema> = ([
    Name,
    TGeneric<Parameters, Expression>
]);
type TFromRef<Context extends TProperties, Ref extends string, Arguments extends TSchema[]> = (Ref extends keyof Context ? TFromType$c<Context, Ref, Context[Ref], Arguments> : TFromNotResolvable);
type TFromType$c<Context extends TProperties, Name extends string, Type extends TSchema, Arguments extends TSchema[]> = (Type extends TGeneric<infer Parameters extends TParameter[], infer Expression extends TSchema> ? TFromGeneric<Name, Parameters, Expression> : Type extends TRef<infer Ref extends string> ? TFromRef<Context, Ref, Arguments> : TFromNotGeneric);
/** Resolves a named generic target from the context, or returns TNever if it cannot be resolved or is not generic. */
type TResolveTarget<Context extends TProperties, Target extends TSchema, Arguments extends TSchema[], Result extends [string, TSchema] = TFromType$c<Context, '(anonymous)', Target, Arguments>> = Result;

type TBindArgument<Context extends TProperties, State extends TState, Name extends string, Extends extends TSchema, Type extends TSchema, InstantiatedArgument extends TSchema = TInstantiateType<Context, State, Type>> = TAssign<Context, {
    [_ in Name]: InstantiatedArgument;
}>;
type TBindArguments<Context extends TProperties, State extends TState, ParameterLeft extends TParameter, ParameterRight extends TParameter[], Arguments extends TSchema[], InstantiatedExtends extends TSchema = TInstantiateType<Context, State, ParameterLeft['extends']>, InstantiatedEquals extends TSchema = TInstantiateType<Context, State, ParameterLeft['equals']>> = (Arguments extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TBindParameters<TBindArgument<Context, State, ParameterLeft['name'], InstantiatedExtends, Left>, State, ParameterRight, Right> : TBindParameters<TBindArgument<Context, State, ParameterLeft['name'], InstantiatedExtends, InstantiatedEquals>, State, ParameterRight, []>);
type TBindParameters<Context extends TProperties, State extends TState, Parameters extends TParameter[], Arguments extends TSchema[]> = (Parameters extends [infer Left extends TParameter, ...infer Right extends TParameter[]] ? TBindArguments<Context, State, Left, Right, Arguments> : Context);
type TResolveArgumentsContext<Context extends TProperties, State extends TState, Parameters extends TParameter[], Arguments extends TSchema[], Result extends TProperties = TBindParameters<Context, State, Parameters, Arguments>> = Result;

type TPeek<State extends TState, Result extends string = State['callstack'] extends [...infer _ extends string[], infer Top extends string] ? Top : ''> = Result;
type TIsTailCall<State extends TState, Name extends string, Result extends boolean = TPeek<State> extends Name ? true : false> = Result;
type TCallDispatch<Context extends TProperties, State extends TState, Target extends TRef, Parameters extends TParameter[], Expression extends TSchema, Arguments extends TSchema[], ArgumentsContext extends TProperties = TResolveArgumentsContext<Context, State, Parameters, Arguments>, ReturnType extends TSchema = TInstantiateType<ArgumentsContext, TState<[...State['callstack'], Target['$ref']], State['visited']>, Expression>> = TInstantiateType<ArgumentsContext, TState<[], []>, ReturnType>;
type TCallDistributed<Context extends TProperties, State extends TState, Target extends TRef, Parameters extends TParameter[], Expression extends TSchema, DistributedArguments extends TSchema[][], Result extends TSchema[] = []> = (DistributedArguments extends [infer Arguments extends TSchema[], ...infer DistributedArguments extends TSchema[][]] ? TCallDispatch<Context, State, Target, Parameters, Expression, Arguments> extends infer ReturnType extends TSchema ? TCallDistributed<Context, State, Target, Parameters, Expression, DistributedArguments, [...Result, ReturnType]> : never : Result);
type TCallImmediate<Context extends TProperties, State extends TState, Target extends TRef, Parameters extends TParameter[], Expression extends TSchema, InstantiatedArguments extends TSchema[], DistributedArguments extends TSchema[][] = TDistributeArguments<Parameters, InstantiatedArguments, Expression>, ReturnTypes extends TSchema[] = TCallDistributed<Context, State, Target, Parameters, Expression, DistributedArguments>, Result extends TSchema = ReturnTypes['length'] extends 1 ? ReturnTypes[0] : TEvaluateUnion<ReturnTypes>> = Result;
type TCallInstantiate<Context extends TProperties, State extends TState, Target extends TSchema, Arguments extends TSchema[], InstantiatedArguments extends TSchema[] = TInstantiateTypes<Context, State, Arguments>, Resolved extends [string, TSchema] = TResolveTarget<Context, Target, Arguments>, Name extends string = Resolved[0], Type extends TSchema = Resolved[1], Result extends TSchema = (Type extends TGeneric<infer Parameters extends TParameter[], infer Expression extends TSchema> ? TIsTailCall<State, Name> extends true ? TCallConstruct<TRef<Name>, InstantiatedArguments> : TCallImmediate<Context, State, TRef<Name>, Parameters, Expression, InstantiatedArguments> : TCallConstruct<Target, InstantiatedArguments>)> = Result;

/** Represents a deferred generic Call */
interface TCall<Target extends TSchema = TSchema, Arguments extends TSchema[] = TSchema[]> extends TSchema {
    '~kind': 'Call';
    type: 'call';
    target: Target;
    arguments: Arguments;
}
type TCallConstruct<Target extends TSchema, Arguments extends TSchema[], Result extends TSchema = TCall<Target, Arguments>> = Result;

type TRemoveImmutableOperation<Type extends TSchema, Result extends TSchema = Type extends TImmutable<infer Type extends TSchema> ? TRemoveImmutableOperation<Type> : Type> = Result;
type TRemoveImmutableAction<Type extends TSchema, Result extends TSchema = TRemoveImmutableOperation<Type>> = Result;
type TRemoveImmutableInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, InstantiateType extends TSchema = TInstantiateType<Context, State, Type>> = TRemoveImmutableAction<InstantiateType>;

interface TMappingType {
    input: string;
    output: string;
}
type TApplyMapping<Mapping extends TMappingType, Value extends string> = ((Mapping & {
    input: Value;
})['output']);

type TFromLiteral$2<Mapping extends TMappingType, Value extends TLiteralValue> = (Value extends string ? TLiteral<TApplyMapping<Mapping, Value>> : TLiteral<Value>);

type TFromTemplateLiteral$2<Mapping extends TMappingType, Pattern extends string, Evaluated extends TSchema = TEvaluateTemplateLiteral<Pattern>, Result extends TSchema = TFromType$b<Mapping, Evaluated>> = Result;

type TFromUnion$6<Mapping extends TMappingType, Types extends TSchema[], Result extends TSchema[] = []> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TFromUnion$6<Mapping, Right, [...Result, TFromType$b<Mapping, Left>]> : TUnion<Result>);

type TFromType$b<Mapping extends TMappingType, Type extends TSchema> = (Type extends TLiteral<infer Value extends TLiteralValue> ? TFromLiteral$2<Mapping, Value> : Type extends TTemplateLiteral<infer Pattern extends string> ? TFromTemplateLiteral$2<Mapping, Pattern> : Type extends TUnion<infer Types extends TSchema[]> ? TFromUnion$6<Mapping, Types> : Type);

/** Creates a deferred Capitalize action. */
type TCapitalizeDeferred<Type extends TSchema> = (TDeferred<'Capitalize', [Type]>);

/** Creates a deferred Lowercase action. */
type TLowercaseDeferred<Type extends TSchema> = (TDeferred<'Lowercase', [Type]>);

/** Creates a deferred Uncapitalize action. */
type TUncapitalizeDeferred<Type extends TSchema> = (TDeferred<'Uncapitalize', [Type]>);

/** Creates a deferred Uppercase action. */
type TUppercaseDeferred<Type extends TSchema> = (TDeferred<'Uppercase', [Type]>);

interface TCapitalizeMapping extends TMappingType {
    output: Capitalize<this['input']>;
}
interface TLowercaseMapping extends TMappingType {
    output: Lowercase<this['input']>;
}
interface TUncapitalizeMapping extends TMappingType {
    output: Uncapitalize<this['input']>;
}
interface TUppercaseMapping extends TMappingType {
    output: Uppercase<this['input']>;
}
type TCapitalizeAction<Type extends TSchema, Result extends TSchema = TCanInstantiate<[Type]> extends true ? TFromType$b<TCapitalizeMapping, Type> : TCapitalizeDeferred<Type>> = Result;
type TLowercaseAction<Type extends TSchema, Result extends TSchema = TCanInstantiate<[Type]> extends true ? TFromType$b<TLowercaseMapping, Type> : TLowercaseDeferred<Type>> = Result;
type TUncapitalizeAction<Type extends TSchema, Result extends TSchema = TCanInstantiate<[Type]> extends true ? TFromType$b<TUncapitalizeMapping, Type> : TUncapitalizeDeferred<Type>> = Result;
type TUppercaseAction<Type extends TSchema, Result extends TSchema = TCanInstantiate<[Type]> extends true ? TFromType$b<TUppercaseMapping, Type> : TUppercaseDeferred<Type>> = Result;
type TCapitalizeInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, InstantiatedType extends TSchema = TInstantiateType<Context, State, Type>> = TCapitalizeAction<InstantiatedType>;
type TLowercaseInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, InstantiatedType extends TSchema = TInstantiateType<Context, State, Type>> = TLowercaseAction<InstantiatedType>;
type TUncapitalizeInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, InstantiatedType extends TSchema = TInstantiateType<Context, State, Type>> = TUncapitalizeAction<InstantiatedType>;
type TUppercaseInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, InstantiatedType extends TSchema = TInstantiateType<Context, State, Type>> = TUppercaseAction<InstantiatedType>;

/** Creates a deferred Conditional action. */
type TConditionalDeferred<Left extends TSchema, Right extends TSchema, True extends TSchema, False extends TSchema> = (TDeferred<'Conditional', [Left, Right, True, False]>);

type TConditionalOperation<Context extends TProperties, State extends TState, Left extends TSchema, Right extends TSchema, True extends TSchema, False extends TSchema, ExtendsResult extends TResult = TExtends<Context, Left, Right>> = (ExtendsResult extends ExtendsResult.TExtendsUnion<infer InferredContext extends TProperties> ? TUnion<[TInstantiateType<InferredContext, State, True>, TInstantiateType<Context, State, False>]> : ExtendsResult extends ExtendsResult.TExtendsTrue<infer InferredContext extends TProperties> ? TInstantiateType<InferredContext, State, True> : TInstantiateType<Context, State, False>);
type TConditionalAction<Context extends TProperties, State extends TState, Left extends TSchema, Right extends TSchema, True extends TSchema, False extends TSchema, Result extends TSchema = TCanInstantiate<[Left, Right]> extends true ? TConditionalOperation<Context, State, Left, Right, True, False> : TConditionalDeferred<Left, Right, True, False>> = Result;
type TConditionalInstantiate<Context extends TProperties, State extends TState, Left extends TSchema, Right extends TSchema, True extends TSchema, False extends TSchema, InstaniatedLeft extends TSchema = TInstantiateType<Context, State, Left>, InstaniatedRight extends TSchema = TInstantiateType<Context, State, Right>> = TConditionalAction<Context, State, InstaniatedLeft, InstaniatedRight, True, False>;

/** Creates a deferred ConstructorParameters action. */
type TConstructorParametersDeferred<Type extends TSchema> = (TDeferred<'ConstructorParameters', [Type]>);

type TConstructorParametersOperation<Type extends TSchema, Parameters extends TSchema[] = Type extends TConstructor ? Type['parameters'] : [], InstantiatedParameters extends TSchema[] = TInstantiateElements<{}, TState<[], []>, Parameters>, Result extends TSchema = TTuple<InstantiatedParameters>> = Result;
type TConstructorParametersAction<Type extends TSchema, Result extends TSchema = TCanInstantiate<[Type]> extends true ? TConstructorParametersOperation<Type> : TConstructorParametersDeferred<Type>> = Result;
type TConstructorParametersInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, InstantiatedType extends TSchema = TInstantiateType<Context, State, Type>> = TConstructorParametersAction<InstantiatedType>;

/** Creates a deferred Exclude action. */
type TExcludeDeferred<Left extends TSchema, Right extends TSchema> = (TDeferred<'Exclude', [Left, Right]>);

type TExcludeAction<Left extends TSchema, Right extends TSchema, Result extends TSchema = TCanInstantiate<[Left, Right]> extends true ? TExcludeOperation<Left, Right> : TExcludeDeferred<Left, Right>> = Result;
type TExcludeInstantiate<Context extends TProperties, State extends TState, Left extends TSchema, Right extends TSchema, InstantiatedLeft extends TSchema = TInstantiateType<Context, State, Left>, InstantiatedRight extends TSchema = TInstantiateType<Context, State, Right>> = TExcludeAction<InstantiatedLeft, InstantiatedRight>;

/** Creates a deferred Extract action. */
type TExtractDeferred<Left extends TSchema, Right extends TSchema> = (TDeferred<'Extract', [Left, Right]>);

type TExtractType<Left extends TSchema, Right extends TSchema, Check extends TResult = TExtends<{}, Left, Right>, Result extends TSchema[] = Check extends TExtendsTrueLike ? [Left] : []> = Result;
type TExtractUnion<Left extends TSchema[], Right extends TSchema, Result extends TSchema[] = []> = (Left extends [infer Head extends TSchema, ...infer Tail extends TSchema[]] ? TExtractUnion<Tail, Right, [...Result, ...TExtractType<Head, Right>]> : Result);
type TExtractOperation<Left extends TSchema, Right extends TSchema, Evaluated extends TSchema = TEvaluateType<Left>, Canonical extends TSchema[] = Evaluated extends TUnion<infer Types extends TSchema[]> ? Types : [Evaluated], Remaining extends TSchema[] = TExtractUnion<Canonical, Right>, Result extends TSchema = TEvaluateUnion<Remaining>> = Result;

type TExtractAction<Left extends TSchema, Right extends TSchema, Result extends TSchema = TCanInstantiate<[Left, Right]> extends true ? TExtractOperation<Left, Right> : TExtractDeferred<Left, Right>> = Result;
type TExtractInstantiate<Context extends TProperties, State extends TState, Left extends TSchema, Right extends TSchema, InstantiatedLeft extends TSchema = TInstantiateType<Context, State, Left>, InstantiatedRight extends TSchema = TInstantiateType<Context, State, Right>> = TExtractAction<InstantiatedLeft, InstantiatedRight>;

/** Creates a deferred Index action. */
type TIndexDeferred<Type extends TSchema, Indexer extends TSchema> = (TDeferred<'Index', [Type, Indexer]>);

type TFromCyclic$4<Defs extends TProperties, Ref extends string, Target extends TSchema = TCyclicTarget<Defs, Ref>, Result extends TProperties = TFromType$a<Target>> = Result;

type TFromDependent$4<If extends TSchema, Then extends TSchema, Else extends TSchema, Evaluated extends TSchema = TEvaluateDependent<If, Then, Else>, Result extends TSchema = TFromType$a<Evaluated>> = Result;

type TCollapseIntersectProperties<Left extends TProperties, Right extends TProperties, LeftKeys extends keyof Left = Exclude<keyof Left, keyof Right>, RightKeys extends keyof Right = Exclude<keyof Right, keyof Left>, SharedKeys extends keyof Left & keyof Right = Extract<keyof Left, keyof Right>, LeftProperties extends TProperties = {
    [Key in LeftKeys]: Left[Key];
}, RightProperties extends TProperties = {
    [Key in RightKeys]: Right[Key];
}, SharedProperties extends TProperties = {
    [Key in SharedKeys]: TEvaluateIntersect<[Left[Key], Right[Key]]>;
}, Unique extends TProperties = TAssign<LeftProperties, RightProperties>, Shared extends TProperties = TAssign<Unique, SharedProperties>> = Shared;
type TFromIntersect$4<Types extends TSchema[], Result extends TProperties = {}> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TFromIntersect$4<Right, TCollapseIntersectProperties<Result, TFromType$a<Left>>> : {
    [Key in keyof Result]: Result[Key];
});

type TFromObject$5<Properties extends TProperties> = (Properties);

type TFromTuple$3<Types extends TSchema[], Object extends TSchema = TTupleToObject<TTuple<Types>>, Result extends TSchema = TFromType$a<Object>> = Result;

type TCollapseUnionProperties<Left extends TProperties, Right extends TProperties, SharedKeys extends PropertyKey = keyof Left & keyof Right, Result extends TProperties = {
    [Key in SharedKeys]: TEvaluateUnion<[Left[Key], Right[Key]]>;
}> = Result;
type TReduceVariants<Types extends TSchema[], Result extends TProperties> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TReduceVariants<Right, TCollapseUnionProperties<Result, TFromType$a<Left>>> : Result);
type TFromUnion$5<Types extends TSchema[]> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TReduceVariants<Right, TFromType$a<Left>> : TUnreachable);

type TFromType$a<Type extends TSchema, Result extends TProperties = (Type extends TCyclic<infer Defs extends TProperties, infer Ref extends string> ? TFromCyclic$4<Defs, Ref> : Type extends TDependent<infer If extends TSchema, infer Then extends TSchema, infer Else extends TSchema> ? TFromDependent$4<If, Then, Else> : Type extends TIntersect<infer Types extends TSchema[]> ? TFromIntersect$4<Types> : Type extends TUnion<infer Types extends TSchema[]> ? TFromUnion$5<Types> : Type extends TTuple<infer Types extends TSchema[]> ? TFromTuple$3<Types> : Type extends TObject<infer Properties extends TProperties> ? TFromObject$5<Properties> : {})> = Result;

type TCollapseToObject<Type extends TSchema, Properties extends TProperties = TFromType$a<Type>, Result extends TSchema = TObject<Properties>> = Result;

type TConvertToIntegerKey<Value extends TLiteralValue, Normal extends string = `${Value}`, Result extends TLiteralValue = (Normal extends ` ${infer _ extends number}` ? Normal : Normal extends `${infer _ extends number} ` ? Normal : Normal extends `0${infer _ extends number}` ? Normal : Normal extends `-${infer _ extends number}` ? Normal : Normal extends `${infer Value extends number}` ? Value : Value)> = Result;

type TNormalizeLiteral<Value extends TLiteralValue, Result extends TSchema = TLiteral<TConvertToIntegerKey<Value>>> = Result;
type TNormalizeIndexerTypes<Types extends TSchema[], Result extends TSchema[] = []> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TNormalizeIndexerTypes<Right, [...Result, TNormalizeIndexer<Left>]> : Result);
type TNormalizeIndexer<Type extends TSchema, Result extends TSchema = (Type extends TIntersect<infer Types extends TSchema[]> ? TIntersect<TNormalizeIndexerTypes<Types>> : Type extends TUnion<infer Types extends TSchema[]> ? TUnion<TNormalizeIndexerTypes<Types>> : Type extends TLiteral<infer Value extends TLiteralValue> ? TNormalizeLiteral<Value> : Type)> = Result;
type TFromArray$2<Type extends TSchema, Indexer extends TSchema, NormalizedIndexer extends TSchema = TNormalizeIndexer<Indexer>, Check extends TResult = TExtends<{}, NormalizedIndexer, TNumber>, Result extends TSchema = (Check extends TExtendsTrueLike ? Type : Indexer extends TLiteral<infer _ extends 'length'> ? TNumber : TNever)> = Result;

type TFromCyclic$3<Defs extends TProperties, Ref extends string, Target extends TSchema = TCyclicTarget<Defs, Ref>, Result extends string[] = TFromType$9<Target>> = Result;

type TFromDependent$3<If extends TSchema, Then extends TSchema, Else extends TSchema, Evaluated extends TSchema = TEvaluateDependent<If, Then, Else>, Result extends string[] = TFromType$9<Evaluated>> = Result;

type TFromEnum$1<Values extends TEnumValue[], Evaluated extends TSchema = TEvaluateEnum<Values>, Result extends string[] = TFromType$9<Evaluated>> = Result;

type TFromIntersect$3<Types extends TSchema[], Evaluated extends TSchema = TEvaluateIntersect<Types>, Result extends string[] = TFromType$9<Evaluated>> = Result;

type TFromLiteral$1<Value extends TLiteralValue, Result extends string[] = [`${Value}`]> = Result;

type TFromTemplateLiteral$1<Pattern extends string, Evaluated extends TSchema = TEvaluateTemplateLiteral<Pattern>, Result extends string[] = TFromType$9<Evaluated>> = Result;

type TFromUnion$4<Types extends TSchema[], Result extends string[] = []> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TFromUnion$4<Right, [...Result, ...TFromType$9<Left>]> : Result);

type TFromType$9<Indexer extends TSchema, Result extends string[] = (Indexer extends TCyclic<infer Defs extends TProperties, infer Ref extends string> ? TFromCyclic$3<Defs, Ref> : Indexer extends TDependent<infer If extends TSchema, infer Then extends TSchema, infer Else extends TSchema> ? TFromDependent$3<If, Then, Else> : Indexer extends TEnum<infer Values extends TEnumValue[]> ? TFromEnum$1<Values> : Indexer extends TIntersect<infer Types extends TSchema[]> ? TFromIntersect$3<Types> : Indexer extends TLiteral<infer Value extends TLiteralValue> ? TFromLiteral$1<Value> : Indexer extends TTemplateLiteral<infer Pattern extends string> ? TFromTemplateLiteral$1<Pattern> : Indexer extends TUnion<infer Types extends TSchema[]> ? TFromUnion$4<Types> : [
])> = Result;

type TToIndexableKeys<Indexer extends TSchema, Result extends string[] = TFromType$9<Indexer>> = Result;

type TFromTypes<Properties extends TProperties, Types extends TSchema[], Result extends TSchema[] = []> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TFromTypes<Properties, Right, [...Result, TFromType$8<Properties, Left>]> : Result);
type TFromType$8<Properties extends TProperties, Type extends TSchema> = (Type extends TArray<infer Type extends TSchema> ? TArray<TFromType$8<Properties, Type>> : Type extends TConstructor<infer Parameters extends TSchema[], infer InstanceType extends TSchema> ? TConstructor<TFromTypes<Properties, Parameters>, TFromType$8<Properties, InstanceType>> : Type extends TFunction<infer Parameters extends TSchema[], infer ReturnType extends TSchema> ? TFunction<TFromTypes<Properties, Parameters>, TFromType$8<Properties, ReturnType>> : Type extends TTuple<infer Types extends TSchema[]> ? TTuple<TFromTypes<Properties, Types>> : Type extends TUnion<infer Types extends TSchema[]> ? TUnion<TFromTypes<Properties, Types>> : Type extends TIntersect<infer Types extends TSchema[]> ? TIntersect<TFromTypes<Properties, Types>> : Type extends TThis ? TObject<Properties> : Type);
type TExpandThis<Properties extends TProperties, Type extends TSchema, Result extends TSchema = TFromType$8<Properties, Type>> = Result;

type TIndexProperty<Properties extends TProperties, Key extends string, CanonicalKey extends string = keyof Properties extends string | number ? `${keyof Properties}` : never, SelectedType extends TSchema = Key extends CanonicalKey ? Properties[Key] : TNever, Result extends TSchema = TExpandThis<Properties, SelectedType>> = Result;
type TIndexProperties<Properties extends TProperties, Keys extends string[], Result extends TSchema[] = []> = (Keys extends [infer Left extends string, ...infer Right extends string[]] ? TIndexProperties<Properties, Right, [...Result, TIndexProperty<Properties, Left>]> : Result);
type TFromIndexer<Properties extends TProperties, Indexer extends TSchema, Keys extends string[] = TToIndexableKeys<Indexer>, Variants extends TSchema[] = TIndexProperties<Properties, Keys>, Result extends TSchema = TEvaluateUnion<Variants>> = Result;
type TNumericKeys<Keys extends string[], Result extends string[] = []> = (Keys extends [infer Left extends string, ...infer Right extends string[]] ? Left extends `${infer _ extends number}` ? TNumericKeys<Right, [...Result, Left]> : TNumericKeys<Right, Result> : Result);
type TFromIndexerNumber<Properties extends TProperties, Keys extends string[] = TPropertyKeys<Properties>, NumericKeys extends string[] = TNumericKeys<Keys>, Variants extends TSchema[] = TIndexProperties<Properties, NumericKeys>, Result extends TSchema = TEvaluateUnion<Variants>> = Result;
type TFromObject$4<Properties extends TProperties, Indexer extends TSchema, Result extends TSchema = Indexer extends TNumber ? TFromIndexerNumber<Properties> : TFromIndexer<Properties, Indexer>> = Result;

type TConvertLiteral<Value extends TLiteralValue, Result extends TSchema = TLiteral<TConvertToIntegerKey<Value>>> = Result;
type TArrayIndexerTypes<Types extends TSchema[], Result extends TSchema[] = []> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TArrayIndexerTypes<Right, [...Result, TFormatArrayIndexer<Left>]> : Result);
/** Formats embedded integer-like strings on an Indexer to be number values inline with TS indexing | coercion behaviors. */
type TFormatArrayIndexer<Type extends TSchema, Result extends TSchema = (Type extends TIntersect<infer Types extends TSchema[]> ? TIntersect<TArrayIndexerTypes<Types>> : Type extends TUnion<infer Types extends TSchema[]> ? TUnion<TArrayIndexerTypes<Types>> : Type extends TLiteral<infer Value extends TLiteralValue> ? TConvertLiteral<Value> : Type)> = Result;

type TIndexElementsWithIndexer<Types extends TSchema[], Indexer extends TSchema, Result extends TSchema[] = []> = (Types extends [...infer Left extends TSchema[], infer Right extends TSchema] ? TExtends<{}, TLiteral<Left['length']>, Indexer> extends TExtendsTrueLike ? TIndexElementsWithIndexer<Left, Indexer, [Right, ...Result]> : TIndexElementsWithIndexer<Left, Indexer, Result> : Result);
type TFromTupleWithIndexer<Types extends TSchema[], Indexer extends TSchema, ArrayIndexer extends TSchema = TFormatArrayIndexer<Indexer>, Elements extends TSchema[] = TIndexElementsWithIndexer<Types, ArrayIndexer>, Result extends TSchema = TEvaluateUnionFast<Elements>> = Result;
type TFromTupleWithoutIndexer<Types extends TSchema[], Result extends TSchema = TEvaluateUnionFast<Types>> = Result;
type TFromTuple$2<Types extends TSchema[], Indexer extends TSchema, Result extends TSchema = (Indexer extends TLiteral<infer _ extends 'length'> ? TLiteral<Types['length']> : Indexer extends TNumber | TInteger ? TFromTupleWithoutIndexer<Types> : TFromTupleWithIndexer<Types, Indexer>)> = Result;

type TFromType$7<Type extends TSchema, Indexer extends TSchema> = (Type extends TArray<infer Type extends TSchema> ? TFromArray$2<Type, Indexer> : Type extends TObject<infer Properties extends TProperties> ? TFromObject$4<Properties, Indexer> : Type extends TTuple<infer Types extends TSchema[]> ? TFromTuple$2<Types, Indexer> : TNever);

type TNormalizeType$1<Type extends TSchema, Result extends TSchema = (Type extends TCyclic ? TCollapseToObject<Type> : Type extends TDependent ? TCollapseToObject<Type> : Type extends TIntersect ? TCollapseToObject<Type> : Type extends TUnion ? TCollapseToObject<Type> : Type)> = Result;
type TIndexAction<Type extends TSchema, Indexer extends TSchema, Result extends TSchema = TCanInstantiate<[Type, Indexer]> extends true ? TFromType$7<TNormalizeType$1<Type>, Indexer> : TIndexDeferred<Type, Indexer>> = Result;
type TIndexInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, Indexer extends TSchema, InstantiatedType extends TSchema = TInstantiateType<Context, State, Type>, InstantiatedIndexer extends TSchema = TInstantiateType<Context, State, Indexer>> = TIndexAction<InstantiatedType, InstantiatedIndexer>;

/** Creates a deferred InstanceType action. */
type TInstanceTypeDeferred<Type extends TSchema> = (TDeferred<'InstanceType', [Type]>);

type TInstanceTypeOperation<Type extends TSchema> = (Type extends TConstructor ? Type['instanceType'] : TNever);
type TInstanceTypeAction<Type extends TSchema, Result extends TSchema = TCanInstantiate<[Type]> extends true ? TInstanceTypeOperation<Type> : TInstanceTypeDeferred<Type>> = Result;
type TInstanceTypeInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, InstantiatedType extends TSchema = TInstantiateType<Context, State, Type>> = TInstanceTypeAction<InstantiatedType>;

/** Creates a deferred KeyOf action. */
type TKeyOfDeferred<Type extends TSchema> = (TDeferred<'KeyOf', [Type]>);

type TFromAny<Result = TUnion<[TNumber, TString, TSymbol]>> = Result;

type TFromArray$1<_Type extends TSchema> = TNumber;

type TFromPropertyKeys<Keys extends PropertyKey[], Result extends TSchema[] = []> = (Keys extends [infer Left extends PropertyKey, ...infer Right extends PropertyKey[]] ? Left extends TLiteralValue ? TFromPropertyKeys<Right, [...Result, TLiteral<Left>]> : TUnreachable : Result);
type TFromObject$3<Properties extends TProperties, PropertyKeys extends PropertyKey[] = TUnionToTuple<keyof Properties>, Variants extends TSchema[] = TFromPropertyKeys<PropertyKeys>, Result extends TSchema = TEvaluateUnionFast<Variants>> = Result;

type TFromRecord<Type extends TRecord, Result extends TSchema = TRecordKey<Type>> = Result;

type TFromTuple$1<Types extends TSchema[], Result extends TSchema[] = []> = (Types extends [...infer Left extends TSchema[], infer _ extends TSchema] ? TFromTuple$1<Left, [TLiteral<Left['length']>, ...Result]> : TEvaluateUnionFast<Result>);

type TFromType$6<Type extends TSchema> = (Type extends TAny ? TFromAny : Type extends TArray<infer Type extends TSchema> ? TFromArray$1<Type> : Type extends TObject<infer Properties extends TProperties> ? TFromObject$3<Properties> : Type extends TRecord ? TFromRecord<Type> : Type extends TTuple<infer Types extends TSchema[]> ? TFromTuple$1<Types> : TNever);

type TNormalizeType<Type extends TSchema, Result extends TSchema = (Type extends TCyclic ? TCollapseToObject<Type> : Type extends TDependent ? TCollapseToObject<Type> : Type extends TIntersect ? TCollapseToObject<Type> : Type extends TUnion ? TCollapseToObject<Type> : Type)> = Result;
type TKeyOfAction<Type extends TSchema, Result extends TSchema = TCanInstantiate<[Type]> extends true ? TFromType$6<TNormalizeType<Type>> : TKeyOfDeferred<Type>> = Result;
type TKeyOfInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, InstantiatedType extends TSchema = TInstantiateType<Context, State, Type>> = TKeyOfAction<InstantiatedType>;

/** Creates a deferred Mapped action. */
type TMappedDeferred<Identifier extends TIdentifier, Type extends TSchema, As extends TSchema, Property extends TSchema> = (TDeferred<'Mapped', [Identifier, Type, As, Property]>);

type TFromTemplateLiteral<Pattern extends string, Evaluated extends TSchema = TEvaluateTemplateLiteral<Pattern>, Result extends TSchema[] = TFromType$5<Evaluated>> = Result;
type TFromUnion$3<Types extends TSchema[], Result extends TSchema[] = []> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TFromUnion$3<Right, [...Result, ...TFromType$5<Left>]> : Result);
type TFromEnum<Values extends TEnumValue[], Evaluated extends TSchema = TEvaluateEnum<Values>, Result extends TSchema[] = TFromType$5<Evaluated>> = Result;
type TFromLiteral<Value extends TLiteralValue, Result extends TSchema[] = Value extends number ? [TLiteral<`${Value}`>] : [TLiteral<Value>]> = Result;
type TFromType$5<Type extends TSchema, Result extends TSchema[] = (Type extends TEnum<infer Values extends TEnumValue[]> ? TFromEnum<Values> : Type extends TLiteral<infer Value extends number> ? TFromLiteral<Value> : Type extends TTemplateLiteral<infer Pattern extends string> ? TFromTemplateLiteral<Pattern> : Type extends TUnion<infer Types extends TSchema[]> ? TFromUnion$3<Types> : [
    Type
])> = Result;
type TMappedVariants<Type extends TSchema, Result extends TSchema[] = TFromType$5<Type>> = Result;

type TCanonicalAs<InstantiatedAs extends TSchema, Result extends TSchema = InstantiatedAs extends TTemplateLiteral<infer Pattern extends string> ? TEvaluateTemplateLiteral<Pattern> : InstantiatedAs> = Result;
type TMappedVariant<Context extends TProperties, State extends TState, Identifier extends TIdentifier, Variant extends TSchema, As extends TSchema, Property extends TSchema, VariantContext extends TProperties = TAssign<Context, {
    [_ in Identifier['name']]: Variant;
}>, InstantiatedAs extends TSchema = TInstantiateType<VariantContext, State, As>, CanonicalAs extends TSchema = TCanonicalAs<InstantiatedAs>, InstantiatedProperty extends TSchema = TInstantiateType<VariantContext, State, Property>, Result extends TProperties = CanonicalAs extends TLiteral<string | number> ? {
    [_ in CanonicalAs['const']]: InstantiatedProperty;
} : {}> = Result;
type TMappedProperties<Context extends TProperties, State extends TState, Identifier extends TIdentifier, Variants extends TSchema[], As extends TSchema, Property extends TSchema, Result extends TProperties[] = []> = (Variants extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TMappedProperties<Context, State, Identifier, Right, As, Property, [...Result, TMappedVariant<Context, State, Identifier, Left, As, Property>]> : Result);
type TReduceProperties<Properties extends TProperties[], Result extends TSchema[] = []> = (Properties extends [infer Left extends TProperties, ...infer Right extends TProperties[]] ? TReduceProperties<Right, [...Result, TObject<Left>]> : Result);
type TMappedOperation<Context extends TProperties, State extends TState, Identifier extends TIdentifier, Type extends TSchema, As extends TSchema, Property extends TSchema, Variants extends TSchema[] = TMappedVariants<Type>, MappedProperties extends TProperties[] = TMappedProperties<Context, State, Identifier, Variants, As, Property>, MappedObjects extends TSchema[] = TReduceProperties<MappedProperties>, Result extends TSchema = TEvaluateIntersect<MappedObjects>> = Result;

type TMappedAction<Context extends TProperties, State extends TState, Identifier extends TIdentifier, Type extends TSchema, As extends TSchema, Property extends TSchema, Result extends TSchema = TCanInstantiate<[Type]> extends true ? TMappedOperation<Context, State, Identifier, Type, As, Property> : TMappedDeferred<Identifier, Type, As, Property>> = Result;
type TMappedInstantiate<Context extends TProperties, State extends TState, Identifier extends TIdentifier, Type extends TSchema, As extends TSchema, Property extends TSchema, InstaniatedType extends TSchema = TInstantiateType<Context, State, Type>> = TMappedAction<Context, State, Identifier, InstaniatedType, As, Property>;

type TInstantiateCyclics<Context extends TProperties, Declarations extends TProperties, CyclicKeys extends string[], DeclarationContext extends TProperties = TAssign<Context, Declarations>, Result extends TProperties = {
    [Key in Extract<keyof Declarations, CyclicKeys[number]>]: TInstantiateCyclic<DeclarationContext, Key, Declarations[Key]>;
}> = Result;
type TInstantiateNonCyclics<Context extends TProperties, Declarations extends TProperties, CyclicKeys extends string[], DeclarationContext extends TProperties = TAssign<Context, Declarations>, Result extends TProperties = {
    [Key in Exclude<keyof Declarations, CyclicKeys[number]>]: TInstantiateType<DeclarationContext, TState<[], []>, Declarations[Key]>;
}> = Result;
type TInstantiateModule<Context extends TProperties, Declarations extends TProperties, CyclicCandidates extends string[] = TCyclicCandidates<Declarations>, InstantiatedCyclics extends TProperties = TInstantiateCyclics<Context, Declarations, CyclicCandidates>, InstantiatedNonCyclics extends TProperties = TInstantiateNonCyclics<Context, Declarations, CyclicCandidates>, InstantiatedModule extends TProperties = InstantiatedCyclics & InstantiatedNonCyclics> = {
    [Key in keyof InstantiatedModule]: InstantiatedModule[Key];
} & {};
type TModuleInstantiate<Context extends TProperties, _State extends TState, Declarations extends TProperties, InstantiatedModule extends TProperties = TInstantiateModule<Context, Declarations>> = InstantiatedModule;

/** Creates a deferred NonNullable action. */
type TNonNullableDeferred<Type extends TSchema> = (TDeferred<'NonNullable', [Type]>);

type TNonNullableOperation<Type extends TSchema, Excluded extends TSchema = TUnion<[TNull, TUndefined]>> = TExcludeAction<Type, Excluded>;
type TNonNullableAction<Type extends TSchema, Result extends TSchema = TCanInstantiate<[Type]> extends true ? TNonNullableOperation<Type> : TNonNullableDeferred<Type>> = Result;
type TNonNullableInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, InstantiatedType extends TSchema = TInstantiateType<Context, State, Type>> = TNonNullableAction<InstantiatedType>;

/** Creates a deferred Omit action. */
type TOmitDeferred<Type extends TSchema, Indexer extends TSchema> = (TDeferred<'Omit', [Type, Indexer]>);

/** Transforms a type into a TProperties used for indexing operations */
type TToIndexable<Type extends TSchema, Collapsed extends TSchema = TCollapseToObject<Type>, Result extends TProperties = (Collapsed extends TObject<infer Properties extends TProperties> ? Properties : TUnreachable)> = Result;

type TNormalKeys<Keys extends string[], UnionKeys extends string = Keys[number], Result extends string | number = (UnionKeys extends `${infer Value extends number}` ? UnionKeys | Value : UnionKeys)> = Result;
type TFromKeys$1<Properties extends TProperties, Keys extends string[], Omitted extends TProperties = Omit<Properties, TNormalKeys<Keys>>, Result extends TProperties = {
    [Key in keyof Omitted]: Omitted[Key];
}> = Result;
type TFromType$4<Type extends TSchema, Indexer extends TSchema, Indexable extends TProperties = TToIndexable<Type>, IndexableKeys extends string[] = TToIndexableKeys<Indexer>, Omitted extends TProperties = TFromKeys$1<Indexable, IndexableKeys>, Result extends TSchema = TObject<Omitted>> = Result;

type TOmitAction<Type extends TSchema, Indexer extends TSchema, Result extends TSchema = TCanInstantiate<[Type, Indexer]> extends true ? TFromType$4<Type, Indexer> : TOmitDeferred<Type, Indexer>> = Result;
type TOmitInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, Indexer extends TSchema, InstantiatedType extends TSchema = TInstantiateType<Context, State, Type>, InstantiatedIndexer extends TSchema = TInstantiateType<Context, State, Indexer>> = TOmitAction<InstantiatedType, InstantiatedIndexer>;

/** Creates a deferred Parameters action. */
type TParametersDeferred<Type extends TSchema> = (TDeferred<'Parameters', [Type]>);

type TParametersOperation<Type extends TSchema, Parameters extends TSchema[] = Type extends TFunction ? Type['parameters'] : [], InstantiatedParameters extends TSchema[] = TInstantiateElements<{}, TState<[], []>, Parameters>, Result extends TSchema = TTuple<InstantiatedParameters>> = Result;
type TParametersAction<Type extends TSchema, Result extends TSchema = TCanInstantiate<[Type]> extends true ? TParametersOperation<Type> : TParametersDeferred<Type>> = Result;
type TParametersInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, InstantiatedType extends TSchema = TInstantiateType<Context, State, Type>> = TParametersAction<InstantiatedType>;

/** Creates a deferred Partial action. */
type TPartialDeferred<Type extends TSchema> = (TDeferred<'Partial', [Type]>);

type TFromCyclic$2<Defs extends TProperties, Ref extends string, Target extends TSchema = TCyclicTarget<Defs, Ref>, Partial extends TSchema = TFromType$3<Target>, Result extends TSchema = TCyclic<TAssign<Defs, {
    [_ in Ref]: Partial;
}>, Ref>> = Result;

type TFromDependent$2<If extends TSchema, Then extends TSchema, Else extends TSchema, Evaluated extends TSchema = TEvaluateDependent<If, Then, Else>, Result extends TSchema = TFromType$3<Evaluated>> = Result;

type TFromIntersect$2<Types extends TSchema[], Evaluated extends TSchema = TEvaluateIntersect<Types>, Result extends TSchema = TFromType$3<Evaluated>> = Result;

type TFromUnion$2<Types extends TSchema[], Result extends TSchema[] = []> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TFromUnion$2<Right, [...Result, TFromType$3<Left>]> : TUnion<Result>);

type TFromObject$2<Properties extends TProperties, Mapped extends TProperties = {
    [Key in keyof Properties]: TAddOptional<Properties[Key]>;
}, Result extends TSchema = TObject<Mapped>> = Result;

type TFromType$3<Type extends TSchema> = (Type extends TCyclic<infer Defs extends TProperties, infer Ref extends string> ? TFromCyclic$2<Defs, Ref> : Type extends TDependent<infer If extends TSchema, infer Then extends TSchema, infer Else extends TSchema> ? TFromDependent$2<If, Then, Else> : Type extends TIntersect<infer Types extends TSchema[]> ? TFromIntersect$2<Types> : Type extends TUnion<infer Types extends TSchema[]> ? TFromUnion$2<Types> : Type extends TObject<infer Properties extends TProperties> ? TFromObject$2<Properties> : TObject<{}>);

type TPartialAction<Type extends TSchema, Result extends TSchema = TCanInstantiate<[Type]> extends true ? TFromType$3<Type> : TPartialDeferred<Type>> = Result;
type TPartialInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, InstantiatedType extends TSchema = TInstantiateType<Context, State, Type>> = TPartialAction<InstantiatedType>;

/** Creates a deferred Pick action. */
type TPickDeferred<Type extends TSchema, Indexer extends TSchema> = (TDeferred<'Pick', [Type, Indexer]>);

type TComparable<Indexable extends TProperties> = (keyof Indexable extends string | number ? `${keyof Indexable}` : never);
type TFromKeys<Indexable extends TProperties, Keys extends string[], Result extends TProperties = {}> = (Keys extends [infer Left extends string, ...infer Right extends string[]] ? Left extends TComparable<Indexable> ? TFromKeys<Indexable, Right, TAssign<Result, {
    [_ in Left]: Indexable[Left];
}>> : TFromKeys<Indexable, Right, Result> : Result);
type TFromType$2<Type extends TSchema, Indexer extends TSchema, Indexable extends TProperties = TToIndexable<Type>, Keys extends string[] = TToIndexableKeys<Indexer>, Applied extends TProperties = TFromKeys<Indexable, Keys>, Result extends TSchema = TObject<Applied>> = Result;

type TPickAction<Type extends TSchema, Indexer extends TSchema, Result extends TSchema = TCanInstantiate<[Type, Indexer]> extends true ? TFromType$2<Type, Indexer> : TPickDeferred<Type, Indexer>> = Result;
type TPickInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, Indexer extends TSchema, InstantiatedType extends TSchema = TInstantiateType<Context, State, Type>, InstantiatedIndexer extends TSchema = TInstantiateType<Context, State, Indexer>> = TPickAction<InstantiatedType, InstantiatedIndexer>;

/** Creates a deferred ReadonlyType action. */
type TReadonlyObjectDeferred<Type extends TSchema> = (TDeferred<'ReadonlyObject', [Type]>);

type TFromArray<Type extends TSchema, Result extends TSchema = TAddImmutable<TArray<Type>>> = Result;

type TFromCyclic$1<Defs extends TProperties, Ref extends string, Target extends TSchema = TCyclicTarget<Defs, Ref>, Partial extends TSchema = TFromType$1<Target>, Result extends TSchema = TCyclic<TAssign<Defs, {
    [_ in Ref]: Partial;
}>, Ref>> = Result;

type TFromDependent$1<If extends TSchema, Then extends TSchema, Else extends TSchema, Evaluated extends TSchema = TEvaluateDependent<If, Then, Else>, Result extends TSchema = TFromType$1<Evaluated>> = Result;

type TFromIntersect$1<Types extends TSchema[], Evaluated extends TSchema = TEvaluateIntersect<Types>, Result extends TSchema = TFromType$1<Evaluated>> = Result;

type TFromObject$1<Properties extends TProperties, Mapped extends TProperties = {
    [Key in keyof Properties]: TAddReadonly<Properties[Key]>;
}, Result extends TSchema = TObject<Mapped>> = Result;

type TFromTuple<Types extends TSchema[], Result extends TSchema = TAddImmutable<TTuple<Types>>> = Result;

type TFromUnion$1<Types extends TSchema[], Result extends TSchema[] = []> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TFromUnion$1<Right, [...Result, TFromType$1<Left>]> : TUnion<Result>);

type TFromType$1<Type extends TSchema> = (Type extends TArray<infer Type extends TSchema> ? TFromArray<Type> : Type extends TCyclic<infer Defs extends TProperties, infer Ref extends string> ? TFromCyclic$1<Defs, Ref> : Type extends TDependent<infer If extends TSchema, infer Then extends TSchema, infer Else extends TSchema> ? TFromDependent$1<If, Then, Else> : Type extends TIntersect<infer Types extends TSchema[]> ? TFromIntersect$1<Types> : Type extends TObject<infer Properties extends TProperties> ? TFromObject$1<Properties> : Type extends TTuple<infer Types extends TSchema[]> ? TFromTuple<Types> : Type extends TUnion<infer Types extends TSchema[]> ? TFromUnion$1<Types> : Type);

type TReadonlyObjectAction<Type extends TSchema, Result extends TSchema = TCanInstantiate<[Type]> extends true ? TFromType$1<Type> : TReadonlyObjectDeferred<Type>> = Result;
type TReadonlyObjectInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, InstantiateType extends TSchema = TInstantiateType<Context, State, Type>> = TReadonlyObjectAction<InstantiateType>;

type TRefInstantiate<Context extends TProperties, State extends TState, Type extends TRef, Ref extends string> = (Ref extends State['visited'][number] ? Type : Ref extends keyof Context ? TInstantiateType<Context, TState<State['callstack'], [...State['visited'], Ref]>, Context[Ref]> : Type);

type TFromCyclic<Defs extends TProperties, Ref extends string, Target extends TSchema = TCyclicTarget<Defs, Ref>, Partial extends TSchema = TFromType<Target>, Result extends TSchema = TCyclic<TAssign<Defs, {
    [_ in Ref]: Partial;
}>, Ref>> = Result;

type TFromDependent<If extends TSchema, Then extends TSchema, Else extends TSchema, Evaluated extends TSchema = TEvaluateDependent<If, Then, Else>, Result extends TSchema = TFromType<Evaluated>> = Result;

type TFromIntersect<Types extends TSchema[], Evaluated extends TSchema = TEvaluateIntersect<Types>, Result extends TSchema = TFromType<Evaluated>> = Result;

type TFromUnion<Types extends TSchema[], Result extends TSchema[] = []> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TFromUnion<Right, [...Result, TFromType<Left>]> : TUnion<Result>);

type TFromObject<Properties extends TProperties, Mapped extends TProperties = {
    [Key in keyof Properties]: TRemoveOptional<Properties[Key]>;
}, Result extends TSchema = TObject<Mapped>> = Result;

type TFromType<Type extends TSchema> = (Type extends TCyclic<infer Defs extends TProperties, infer Ref extends string> ? TFromCyclic<Defs, Ref> : Type extends TDependent<infer If extends TSchema, infer Then extends TSchema, infer Else extends TSchema> ? TFromDependent<If, Then, Else> : Type extends TIntersect<infer Types extends TSchema[]> ? TFromIntersect<Types> : Type extends TUnion<infer Types extends TSchema[]> ? TFromUnion<Types> : Type extends TObject<infer Properties extends TProperties> ? TFromObject<Properties> : TObject<{}>);

/** Creates a deferred Required action. */
type TRequiredDeferred<Type extends TSchema> = (TDeferred<'Required', [Type]>);

type TRequiredAction<Type extends TSchema, Result extends TSchema = TCanInstantiate<[Type]> extends true ? TFromType<Type> : TRequiredDeferred<Type>> = Result;
type TRequiredInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, InstantiatedType extends TSchema = TInstantiateType<Context, State, Type>> = TRequiredAction<InstantiatedType>;

/** Creates a deferred ReturnType action. */
type TReturnTypeDeferred<Type extends TSchema> = (TDeferred<'ReturnType', [Type]>);

type TReturnTypeOperation<Type extends TSchema> = (Type extends TFunction ? Type['returnType'] : TNever);
type TReturnTypeAction<Type extends TSchema, Result extends TSchema = TCanInstantiate<[Type]> extends true ? TReturnTypeOperation<Type> : TReturnTypeDeferred<Type>> = Result;
type TReturnTypeInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, InstantiatedType extends TSchema = TInstantiateType<Context, State, Type>> = TReturnTypeAction<InstantiatedType>;

/** Creates a deferred With action. */
type TWithDeferred<Type extends TSchema, Options extends TSchema> = (TDeferred<'With', [Type, Options]>);
/** Applies annotation options to the given type. */
type TWith<Type extends TSchema, Options extends TSchema> = (Type & Options);

type TWithAction<Type extends TSchema, Options extends TSchema, Result extends TSchema = TCanInstantiate<[Type]> extends true ? TWith<Type, Options> : TWithDeferred<Type, Options>> = Result;
type TWithInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, Options extends TSchema, InstantiatedType extends TSchema = TInstantiateType<Context, State, Type>> = TWithAction<InstantiatedType, Options>;

type TSpreadElement<Type extends TSchema, Result extends TSchema[] = (Type extends TRest<infer Rest extends TSchema> ? (Rest extends TTuple<infer Elements extends TSchema[]> ? TRestSpread<Elements> : Rest extends TInfer<string, TSchema> ? [Type] : Rest extends TRef<string> ? [Type] : [
    TNever
]) : [Type])> = Result;
type TRestSpread<Types extends TSchema[], Result extends TSchema[] = []> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TRestSpread<Right, [...Result, ...TSpreadElement<Left>]> : Result);

interface TState<CallStack extends string[] = string[], Visited extends string[] = string[]> {
    callstack: CallStack;
    visited: Visited;
}
type TCanInstantiate<Types extends TSchema[]> = Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? Left extends TRef ? false : TCanInstantiate<Right> : true;
type TInstantiateProperties<Context extends TProperties, State extends TState, Properties extends TProperties, Result extends TProperties = {
    [Key in keyof Properties]: TInstantiateType<Context, State, Properties[Key]>;
}> = Result;
type TInstantiateElements<Context extends TProperties, State extends TState, Types extends TSchema[], Elements extends TSchema[] = TInstantiateTypes<Context, State, Types>, Result extends TSchema[] = TRestSpread<Elements>> = Result;
type TInstantiateTypes<Context extends TProperties, State extends TState, Types extends TSchema[], Result extends TSchema[] = []> = (Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TInstantiateTypes<Context, State, Right, [...Result, TInstantiateType<Context, State, Left>]> : Result);
type TWithModifiers<Type extends TSchema, InstantiatedType extends TSchema, WithOptional extends TSchema = Type extends TOptional ? TAddOptionalAction<InstantiatedType> : InstantiatedType, WithReadonly extends TSchema = Type extends TReadonly ? TAddReadonlyAction<WithOptional> : WithOptional, WithImmutable extends TSchema = Type extends TImmutable ? TAddImmutableAction<WithReadonly> : WithReadonly> = WithImmutable;
type TInstantiateDeferred<Context extends TProperties, State extends TState, Action extends string, Parameters extends TSchema[]> = ([
    Action,
    Parameters
] extends ['AddImmutable', [infer Type extends TSchema]] ? TAddImmutableInstantiate<Context, State, Type> : [
    Action,
    Parameters
] extends ['RemoveImmutable', [infer Type extends TSchema]] ? TRemoveImmutableInstantiate<Context, State, Type> : [
    Action,
    Parameters
] extends ['AddReadonly', [infer Type extends TSchema]] ? TAddReadonlyInstantiate<Context, State, Type> : [
    Action,
    Parameters
] extends ['RemoveReadonly', [infer Type extends TSchema]] ? TRemoveReadonlyInstantiate<Context, State, Type> : [
    Action,
    Parameters
] extends ['AddOptional', [infer Type extends TSchema]] ? TAddOptionalInstantiate<Context, State, Type> : [
    Action,
    Parameters
] extends ['RemoveOptional', [infer Type extends TSchema]] ? TRemoveOptionalInstantiate<Context, State, Type> : [
    Action,
    Parameters
] extends ['Capitalize', [infer Type extends TSchema]] ? TCapitalizeInstantiate<Context, State, Type> : [
    Action,
    Parameters
] extends ['Conditional', [infer Left extends TSchema, infer Right extends TSchema, infer True extends TSchema, infer False extends TSchema]] ? TConditionalInstantiate<Context, State, Left, Right, True, False> : [
    Action,
    Parameters
] extends ['ConstructorParameters', [infer Type extends TSchema]] ? TConstructorParametersInstantiate<Context, State, Type> : [
    Action,
    Parameters
] extends ['Evaluate', [infer Type extends TSchema]] ? TEvaluateInstantiate<Context, State, Type> : [
    Action,
    Parameters
] extends ['Exclude', [infer Left extends TSchema, infer Right extends TSchema]] ? TExcludeInstantiate<Context, State, Left, Right> : [
    Action,
    Parameters
] extends ['Extract', [infer Left extends TSchema, infer Right extends TSchema]] ? TExtractInstantiate<Context, State, Left, Right> : [
    Action,
    Parameters
] extends ['Index', [infer Type extends TSchema, infer Indexer extends TSchema]] ? TIndexInstantiate<Context, State, Type, Indexer> : [
    Action,
    Parameters
] extends ['InstanceType', [infer Type extends TSchema]] ? TInstanceTypeInstantiate<Context, State, Type> : [
    Action,
    Parameters
] extends ['Interface', [infer Heritage extends TSchema[], infer Properties extends TProperties]] ? TInterfaceInstantiate<Context, State, Heritage, Properties> : [
    Action,
    Parameters
] extends ['KeyOf', [infer Type extends TSchema]] ? TKeyOfInstantiate<Context, State, Type> : [
    Action,
    Parameters
] extends ['Lowercase', [infer Type extends TSchema]] ? TLowercaseInstantiate<Context, State, Type> : [
    Action,
    Parameters
] extends ['Mapped', [infer Name extends TIdentifier, infer Key extends TSchema, infer As extends TSchema, infer Property extends TSchema]] ? TMappedInstantiate<Context, State, Name, Key, As, Property> : [
    Action,
    Parameters
] extends ['Module', [infer Declarations extends TProperties]] ? TModuleInstantiate<Context, State, Declarations> : [
    Action,
    Parameters
] extends ['NonNullable', [infer Type extends TSchema]] ? TNonNullableInstantiate<Context, State, Type> : [
    Action,
    Parameters
] extends ['Pick', [infer Type extends TSchema, infer Indexer extends TSchema]] ? TPickInstantiate<Context, State, Type, Indexer> : [
    Action,
    Parameters
] extends ['Parameters', [infer Type extends TSchema]] ? TParametersInstantiate<Context, State, Type> : [
    Action,
    Parameters
] extends ['Partial', [infer Type extends TSchema]] ? TPartialInstantiate<Context, State, Type> : [
    Action,
    Parameters
] extends ['Omit', [infer Type extends TSchema, infer Indexer extends TSchema]] ? TOmitInstantiate<Context, State, Type, Indexer> : [
    Action,
    Parameters
] extends ['ReadonlyObject', [infer Type extends TSchema]] ? TReadonlyObjectInstantiate<Context, State, Type> : [
    Action,
    Parameters
] extends ['Record', [infer Key extends TSchema, infer Value extends TSchema]] ? TRecordInstantiate<Context, State, Key, Value> : [
    Action,
    Parameters
] extends ['Required', [infer Type extends TSchema]] ? TRequiredInstantiate<Context, State, Type> : [
    Action,
    Parameters
] extends ['ReturnType', [infer Type extends TSchema]] ? TReturnTypeInstantiate<Context, State, Type> : [
    Action,
    Parameters
] extends ['TemplateLiteral', [infer Types extends TSchema[]]] ? TTemplateLiteralInstantiate<Context, State, Types> : [
    Action,
    Parameters
] extends ['Uncapitalize', [infer Type extends TSchema]] ? TUncapitalizeInstantiate<Context, State, Type> : [
    Action,
    Parameters
] extends ['Uppercase', [infer Type extends TSchema]] ? TUppercaseInstantiate<Context, State, Type> : [
    Action,
    Parameters
] extends ['With', [infer Type extends TSchema, infer Options extends TSchema]] ? TWithInstantiate<Context, State, Type, Options> : TDeferred<Action, Parameters>);
type TInstantiateImmediate<Context extends TProperties, State extends TState, Type extends TSchema, InstantiatedType extends TSchema = (Type extends TRef<infer Ref extends string> ? TRefInstantiate<Context, State, Type, Ref> : Type extends TArray<infer Type extends TSchema> ? TArray<TInstantiateType<Context, State, Type>> : Type extends TCall<infer Target extends TSchema, infer Parameters extends TSchema[]> ? TCallInstantiate<Context, State, Target, Parameters> : Type extends TConstructor<infer Parameters extends TSchema[], infer InstanceType extends TSchema> ? TConstructor<TInstantiateTypes<Context, State, Parameters>, TInstantiateType<Context, State, InstanceType>> : Type extends TFunction<infer Parameters extends TSchema[], infer ReturnType extends TSchema> ? TFunction<TInstantiateTypes<Context, State, Parameters>, TInstantiateType<Context, State, ReturnType>> : Type extends TDependent<infer If extends TSchema, infer Then extends TSchema, infer Else extends TSchema> ? TDependent<TInstantiateType<Context, State, If>, TInstantiateType<Context, State, Then>, TInstantiateType<Context, State, Else>> : Type extends TIntersect<infer Types extends TSchema[]> ? TIntersect<TInstantiateTypes<Context, State, Types>> : Type extends TObject<infer Properties extends TProperties> ? TObject<TInstantiateProperties<Context, State, Properties>> : Type extends TRecord<infer Key extends string, infer Type extends TSchema> ? TRecord<Key, TInstantiateType<Context, State, Type>> : Type extends TRest<infer Type extends TSchema> ? TRest<TInstantiateType<Context, State, Type>> : Type extends TTuple<infer Types extends TSchema[]> ? TTuple<TInstantiateElements<Context, State, Types>> : Type extends TUnion<infer Types extends TSchema[]> ? TUnion<TInstantiateTypes<Context, State, Types>> : Type), WithModifiers extends TSchema = TWithModifiers<Type, InstantiatedType>> = WithModifiers;
type TInstantiateType<Context extends TProperties, State extends TState, Type extends TSchema, Result extends TSchema = Type extends TDeferred<infer Action extends string, infer Types extends TSchema[]> ? TInstantiateDeferred<Context, State, Action, Types> : TInstantiateImmediate<Context, State, Type>> = Result;
/** Instantiates computed schematics using the given context and type. */
type TInstantiate<Context extends TProperties, Type extends TSchema> = (TInstantiateType<Context, TState<[], []>, Type>);

type TAddOptionalOperation<Type extends TSchema, Result extends TSchema = `~optional` extends keyof Type ? Type : TOptional<Type>> = Result;
type TAddOptionalAction<Type extends TSchema, Result extends TSchema = TAddOptionalOperation<Type>> = Result;
type TAddOptionalInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, InstantiateType extends TSchema = TInstantiateType<Context, State, Type>> = TAddOptionalAction<InstantiateType>;

/** Applies an AddOptional action to a type. */
type TAddOptional<Type extends TSchema> = (TAddOptionalAction<Type>);

type TOptional<Type extends TSchema = TSchema> = (Type & {
    '~optional': true;
});

type StaticLast<Stack extends string[], Direction extends StaticDirection, Context extends TProperties, This extends TProperties, Type extends TSchema, Result extends unknown[]> = (Type extends TRest<infer RestType extends TSchema> ? RestType extends TArray<infer ArrayType extends TSchema> ? [...Result, ...TStaticElement<Stack, Direction, Context, This, ArrayType>[0][]] : [...Result, never] : [...Result, ...TStaticElement<Stack, Direction, Context, This, Type>]);
type TStaticElement<Stack extends string[], Direction extends StaticDirection, Context extends TProperties, This extends TProperties, Type extends TSchema, IsReadonly extends boolean = Type extends TReadonly ? true : false, IsOptional extends boolean = Type extends TOptional ? true : false, Inferred extends unknown = StaticType<Stack, Direction, Context, This, Type>, Result extends [unknown?] = ([
    IsReadonly,
    IsOptional
] extends [true, true] ? [Readonly<Inferred>?] : [
    IsReadonly,
    IsOptional
] extends [false, true] ? [Inferred?] : [
    IsReadonly,
    IsOptional
] extends [true, false] ? [Readonly<Inferred>] : [
    Inferred
])> = Result;
type TStaticElements<Stack extends string[], Direction extends StaticDirection, Context extends TProperties, This extends TProperties, Types extends TSchema[], Result extends unknown[] = []> = (Types extends [infer Last extends TSchema] ? StaticLast<Stack, Direction, Context, This, Last, Result> : Types extends [infer Left extends TSchema, ...infer Right extends TSchema[]] ? TStaticElements<Stack, Direction, Context, This, Right, [...Result, ...TStaticElement<Stack, Direction, Context, This, Left>]> : Result);
type StaticTuple<Stack extends string[], Direction extends StaticDirection, Context extends TProperties, This extends TProperties, Tuple extends TSchema, Items extends TSchema[], Elements extends unknown[] = TStaticElements<Stack, Direction, Context, This, Items>, Result extends readonly unknown[] = (Tuple extends TImmutable ? readonly [...Elements] : Elements)> = Result;
/** Represents a Tuple type. */
interface TTuple<Types extends TSchema[] = TSchema[]> extends TSchema {
    '~kind': 'Tuple';
    type: 'array';
    additionalItems: false;
    items: Types;
    minItems: Types['length'];
}

type StaticInstantiatedParameters<Stack extends string[], Direction extends StaticDirection, Context extends TProperties, This extends TProperties, Parameters extends TSchema[], Evaluated extends TSchema = TInstantiate<Context, TTuple<Parameters>>, Static extends unknown = StaticType<Stack, Direction, Context, This, Evaluated>, Result extends unknown[] = Static extends unknown[] ? Static : []> = Result;
type StaticFunction<Stack extends string[], Direction extends StaticDirection, Context extends TProperties, This extends TProperties, Parameters extends TSchema[], ReturnType extends TSchema, StaticParameters extends unknown[] = StaticInstantiatedParameters<Stack, Direction, Context, This, Parameters>, StaticReturnType extends unknown = StaticType<Stack, Direction, Context, This, ReturnType>, Result = (...args: StaticParameters) => StaticReturnType> = Result;
/** Represents a Function type. */
interface TFunction<Parameters extends TSchema[] = TSchema[], ReturnType extends TSchema = TSchema> extends TSchema {
    '~kind': 'Function';
    type: 'function';
    parameters: Parameters;
    returnType: ReturnType;
}

type StaticConstructor<Stack extends string[], Direction extends StaticDirection, Context extends TProperties, This extends TProperties, Parameters extends TSchema[], InstanceType extends TSchema, StaticParameters extends unknown[] = StaticInstantiatedParameters<Stack, Direction, Context, This, Parameters>, StaticReturnType extends unknown = StaticType<Stack, Direction, Context, This, InstanceType>, Result = new (...args: StaticParameters) => StaticReturnType> = Result;
/** Represents a Constructor type. */
interface TConstructor<Parameters extends TSchema[] = TSchema[], InstanceType extends TSchema = TSchema> extends TSchema {
    '~kind': 'Constructor';
    type: 'constructor';
    parameters: Parameters;
    instanceType: InstanceType;
}

type XSchemaObject = object;
type XSchemaBoolean = boolean;
type XSchema = XSchemaObject | XSchemaBoolean;

type XCanonicalTuple<Value extends readonly unknown[]> = (Value extends [infer Left, ...infer Right extends unknown[]] ? [XCanonical<Left>, ...XCanonicalTuple<Right>] : []);
type XCanonicalArray<Value extends unknown, Result extends unknown[] = XCanonical<Value>[]> = Result;
type XCanonicalObject<Value extends object, Result extends Record<PropertyKey, unknown> = {
    -readonly [Key in keyof Value]: XCanonical<Value[Key]>;
}> = Result;
type XCanonical<Schema extends unknown> = (Schema extends readonly [...infer Schemas extends unknown[]] ? XCanonicalTuple<Schemas> : Schema extends readonly (infer Schema)[] ? XCanonicalArray<Schema> : Schema extends object ? XCanonicalObject<Schema> : Schema);

interface XAdditionalProperties<AdditionalProperties extends XSchema = XSchema> {
    additionalProperties: AdditionalProperties;
}

interface XAnyOf<AnyOf extends XSchema[] = XSchema[]> {
    anyOf: AnyOf;
}

interface XAllOf<AllOf extends XSchema[] = XSchema[]> {
    allOf: AllOf;
}

interface XConst<Const extends unknown = unknown> {
    const: Const;
}

interface XEnum<Enum extends unknown[] = unknown[]> {
    enum: Enum;
}

interface XIf<If extends XSchema = XSchema> {
    if: If;
}

interface XItems<Items extends (XSchema | XSchema[]) = (XSchema | XSchema[])> {
    items: Items;
}

interface XOneOf<OneOf extends XSchema[] = XSchema[]> {
    oneOf: OneOf;
}

interface XPatternProperties<PatternProperties extends Record<PropertyKey, XSchema> = Record<PropertyKey, XSchema>> {
    patternProperties: PatternProperties;
}

interface XPrefixItems<PrefixItems extends XSchema[] = XSchema[]> {
    prefixItems: PrefixItems;
}

interface XProperties<Properties extends Record<PropertyKey, XSchema> = Record<PropertyKey, XSchema>> {
    properties: Properties;
}

interface XPropertyNames<PropertyNames extends XSchema = XSchema> {
    propertyNames: PropertyNames;
}

interface XRef<Ref extends string = string> {
    $ref: Ref;
}

interface XRequired<Required extends string[] = string[]> {
    required: Required;
}

interface XType<Type extends string | string[] = string | string[]> {
    type: Type;
}

interface XUnevaluatedProperties<UnevaluatedProperties extends XSchema = XSchema> {
    unevaluatedProperties: UnevaluatedProperties;
}

type XStaticAdditionalProperties<Stack extends string[], Root extends XSchema, Schema extends XSchema, Result extends Record<PropertyKey, unknown> = (Schema extends true ? {
    [key: string]: unknown;
} : Schema extends false ? {} : {
    [key: string]: XStaticSchema<Stack, Root, Schema>;
})> = Result;

type XStaticAllOf<Stack extends string[], Root extends XSchema, Schemas extends XSchema[], Result extends unknown = unknown> = (Schemas extends readonly [infer Left extends XSchema, ...infer Right extends XSchema[]] ? XStaticAllOf<Stack, Root, Right, Result & XStaticSchema<Stack, Root, Left>> : Result);

type XStaticAnyOf<Stack extends string[], Root extends XSchema, Schemas extends XSchema[], Result extends unknown = never> = (Schemas extends [infer Left extends XSchema, ...infer Right extends XSchema[]] ? XStaticAnyOf<Stack, Root, Right, XStaticSchema<Stack, Root, Left> | Result> : Result);

type XStaticConst<Value extends unknown> = Value;

type XStaticEnum<Values extends unknown[], Result extends unknown = never> = (Values extends [infer Left extends unknown, ...infer Right extends unknown[]] ? XStaticEnum<Right, Left | Result> : Result);

interface XElse<Else extends XSchema = XSchema> {
    else: Else;
}

interface XThen<Then extends XSchema = XSchema> {
    then: Then;
}

type XStaticIf<Stack extends string[], Root extends XSchema, Schema extends XIf, IfSchema extends XSchema, If extends unknown = XStaticSchema<Stack, Root, IfSchema>, Then extends unknown = Schema extends XThen<infer ThenSchema extends XSchema> ? XStaticSchema<Stack, Root, ThenSchema> : never, Else extends unknown = Schema extends XElse<infer ElseSchema extends XSchema> ? XStaticSchema<Stack, Root, ElseSchema> : never, IsThen extends boolean = Schema extends XThen ? true : false, IsElse extends boolean = Schema extends XElse ? true : false, Result extends unknown = ([
    IsThen,
    IsElse
] extends [true, true] ? (If & Then) | Exclude<Else, If> : [
    IsThen,
    IsElse
] extends [true, false] ? (If & Then) : [
    IsThen,
    IsElse
] extends [false, true] ? Exclude<Else, If> : unknown)> = Result;

interface XMinItems<MinItems extends number = number> {
    minItems: MinItems;
}

interface XMaxItems<MaxItems extends number = number> {
    maxItems: MaxItems;
}

interface XAdditionalItems<AdditionalItems extends XSchema = XSchema> {
    additionalItems: AdditionalItems;
}

type XBuildTuple<Size extends number, Tuple extends unknown[] = []> = (Tuple['length'] extends Size ? Tuple : XBuildTuple<Size, [...Tuple, unknown]>);
type XLessThan<Left extends number, Right extends number> = Left extends Right ? false : XBuildTuple<Left> extends [...XBuildTuple<Right>, ...infer _Rest] ? false : true;

type XWithElements<Stack extends string[], Root extends XSchema, Schemas extends XSchema[], Result extends unknown[] = []> = (Schemas extends [infer Left extends XSchema, ...infer Right extends XSchema[]] ? XWithElements<Stack, Root, Right, [...Result, XStaticSchema<Stack, Root, Left>]> : Result);
type XWithMaxItemsRemap<Elements extends unknown[], MaxItems extends number, Result extends unknown[] = []> = (Elements extends [infer Left extends unknown, ...infer Right extends unknown[]] ? XLessThan<Result['length'], MaxItems> extends true ? XWithMaxItemsRemap<Right, MaxItems, [...Result, Left]> : Result : Result);
type XWithMaxItems<Schema extends XSchema, Elements extends unknown[], Result extends unknown[] = Schema extends XMaxItems<infer MaxItems extends number> ? XWithMaxItemsRemap<Elements, MaxItems> : Elements> = Result;
type XNeedsAdditionalItems<Schema extends XSchema, Elements extends unknown[], Result extends boolean = (Schema extends XMaxItems<infer MaxItems extends number> ? XLessThan<Elements['length'], MaxItems> : true)> = Result;
type XWithMinItemsRemap<Elements extends unknown[], MinItems extends number, Result extends unknown[] = []> = (Elements extends [infer Left, ...infer Right] ? XLessThan<Result['length'], MinItems> extends true ? XWithMinItemsRemap<Right, MinItems, [...Result, Left]> : XWithMinItemsRemap<Right, MinItems, [...Result, Left?]> : Result);
type XWithMinItems<Schema extends XSchema, Values extends unknown[], MinItems extends number = Schema extends XMinItems<infer MinItems extends number> ? MinItems : 0, Result extends unknown[] = XWithMinItemsRemap<Values, MinItems>> = Result;
type XWithAdditionalItems<Stack extends string[], Root extends XSchema, Schema extends XSchema, Elements extends unknown[], Result extends unknown[] = Schema extends XAdditionalItems<infer Schema extends XSchema> ? (Schema extends true ? [...Elements, ...unknown[]] : Schema extends false ? [...Elements] : [
    ...Elements,
    ...XStaticSchema<Stack, Root, Schema>[]
]) : [...Elements, ...unknown[]]> = Result;
type XStaticElements<Stack extends string[], Root extends XSchema, Schema extends XSchema, PrefixItems extends XSchema[], WithElements extends unknown[] = XWithElements<Stack, Root, PrefixItems>, WithMaxItems extends unknown[] = XWithMaxItems<Schema, WithElements>, NeedsAdditional extends boolean = XNeedsAdditionalItems<Schema, WithMaxItems>, WithMinItems extends unknown[] = XWithMinItems<Schema, WithMaxItems>, WithAdditionalItems extends unknown[] = NeedsAdditional extends true ? XWithAdditionalItems<Stack, Root, Schema, WithMinItems> : WithMinItems> = WithAdditionalItems;

type XFromSized<Stack extends string[], Root extends XSchema, Schema extends XSchema, Items extends XSchema[]> = (XStaticElements<Stack, Root, Schema, Items>);
type XFromUnsized<Stack extends string[], Root extends XSchema, Schema extends XSchema> = (XStaticSchema<Stack, Root, Schema>[]);
type XStaticItems<Stack extends string[], Root extends XSchema, Schema extends XSchema, Items extends XSchema[] | XSchema, Result extends unknown = (Items extends XSchema[] ? XFromSized<Stack, Root, Schema, [...Items]> : Items extends XSchema ? XFromUnsized<Stack, Root, Items> : never)> = Result;

type XStaticOneOf<Stack extends string[], Root extends XSchema, Schemas extends XSchema[], Result extends unknown = never> = (Schemas extends [infer Left extends XSchema, ...infer Right extends XSchema[]] ? XStaticOneOf<Stack, Root, Right, XStaticSchema<Stack, Root, Left> | Result> : Result);

type XStaticPatternProperties<Stack extends string[], Root extends XSchema, Properties extends Record<PropertyKey, XSchema> = Record<PropertyKey, XSchema>, InferredProperties extends Record<PropertyKey, unknown> = {
    [Key in keyof Properties]: XStaticSchema<Stack, Root, Properties[Key]>;
}, EvaluatedProperties extends unknown = {
    [key: string]: InferredProperties[keyof InferredProperties];
}> = EvaluatedProperties;

type XStaticPrefixItems<Stack extends string[], Root extends XSchema, Schema extends XSchema, PrefixItems extends XSchema[], Result extends unknown[] = XStaticElements<Stack, Root, Schema, PrefixItems>> = Result;

type XIsReadonly<Schema extends XSchema> = (Schema extends {
    readOnly: true;
} ? true : Schema extends {
    '~readonly': true;
} ? true : false);
type XRequiredArray<Schema extends XSchema, Result extends PropertyKey[] = Schema extends XRequired<infer Keys extends string[]> ? Keys : []> = Result;
type XReadonlyKeys<Properties extends Record<PropertyKey, XSchema>, ReadonlyProperties extends Record<PropertyKey, unknown> = {
    [Key in keyof Properties as XIsReadonly<Properties[Key]> extends true ? Key : never]: unknown;
}, Result extends PropertyKey = keyof ReadonlyProperties> = Result;
type XRequiredKeys<Properties extends Record<PropertyKey, XSchema>, RequiredArray extends string[], Result extends PropertyKey = RequiredArray extends [] ? never : Extract<keyof Properties, RequiredArray[number]>> = Result;
type XUnknownKeys<Properties extends Record<PropertyKey, XSchema>, RequiredArray extends string[], Result extends PropertyKey = Exclude<RequiredArray[number], keyof Properties>> = Result;
type XOptionalKeys<Properties extends Record<PropertyKey, XSchema>, RequiredArray extends string[], Result extends PropertyKey = RequiredArray extends [] ? keyof Properties : Exclude<keyof Properties, RequiredArray[number]>> = Result;
type XReadonlyOptionalProperties<Stack extends string[], Root extends XSchema, OptionalKeys extends PropertyKey, Properties extends Record<PropertyKey, XSchema>> = {
    readonly [Key in Extract<keyof Properties, OptionalKeys>]?: XStaticSchema<Stack, Root, Properties[Key]>;
};
type XReadonlyRequiredProperties<Stack extends string[], Root extends XSchema, RequiredKeys extends PropertyKey, Properties extends Record<PropertyKey, XSchema>> = {
    readonly [Key in Extract<keyof Properties, RequiredKeys>]: XStaticSchema<Stack, Root, Properties[Key]>;
};
type XOptionalProperties<Stack extends string[], Root extends XSchema, OptionalKeys extends PropertyKey, Properties extends Record<PropertyKey, XSchema>> = {
    [Key in Extract<keyof Properties, OptionalKeys>]?: XStaticSchema<Stack, Root, Properties[Key]>;
};
type XRequiredProperties<Stack extends string[], Root extends XSchema, RequiredKeys extends PropertyKey, Properties extends Record<PropertyKey, XSchema>> = {
    [Key in Extract<keyof Properties, RequiredKeys>]: XStaticSchema<Stack, Root, Properties[Key]>;
};
type XUnknownProperties<UnknownKeys extends PropertyKey> = {
    [Key in UnknownKeys]: unknown;
};
type XStaticProperties<Stack extends string[], Root extends XSchema, Schema extends XSchema, Properties extends Record<PropertyKey, XSchema>, RequiredArray extends string[] = XRequiredArray<Schema>, ReadonlyKeys extends PropertyKey = XReadonlyKeys<Properties>, OptionalKeys extends PropertyKey = XOptionalKeys<Properties, RequiredArray>, RequiredKeys extends PropertyKey = XRequiredKeys<Properties, RequiredArray>, UnknownKeys extends PropertyKey = XUnknownKeys<Properties, RequiredArray>, ReadonlyOptionalProperties extends Record<PropertyKey, unknown> = XReadonlyOptionalProperties<Stack, Root, Extract<OptionalKeys, ReadonlyKeys>, Properties>, ReadonlyRequiredProperties extends Record<PropertyKey, unknown> = XReadonlyRequiredProperties<Stack, Root, Extract<RequiredKeys, ReadonlyKeys>, Properties>, OptionalProperties extends Record<PropertyKey, unknown> = XOptionalProperties<Stack, Root, Exclude<OptionalKeys, ReadonlyKeys>, Properties>, RequiredProperties extends Record<PropertyKey, unknown> = XRequiredProperties<Stack, Root, Exclude<RequiredKeys, ReadonlyKeys>, Properties>, UnknownProperties extends Record<PropertyKey, unknown> = XUnknownProperties<UnknownKeys>, Result extends Record<PropertyKey, unknown> = (ReadonlyOptionalProperties & ReadonlyRequiredProperties & OptionalProperties & RequiredProperties & UnknownProperties)> = Result;

type XStaticPropertyNames<Stack extends string[], Root extends XSchema, Schema extends XSchema, StaticKey extends unknown = XStaticSchema<Stack, Root, Schema>, Result extends Record<string, unknown> = [StaticKey] extends [PropertyKey] ? {
    [Key in StaticKey]?: unknown;
} : {}> = Result;

type TEscape0<Index extends string> = Index extends `${infer Left}~0${infer Right}` ? `${Left}~${TEscape<Right>}` : Index;
type TEscape1<Index extends string> = Index extends `${infer Left}~1${infer Right}` ? `${Left}/${TEscape<Right>}` : Index;
type TEscape<Index extends string, Escaped0 extends string = TEscape0<Index>, Escaped1 extends string = TEscape1<Escaped0>> = Escaped1;
type IndicesReduce<Pointer extends string, Result extends string[] = []> = (Pointer extends `${infer Left extends string}/${infer Right extends string}` ? Left extends '' ? IndicesReduce<Right, Result> : IndicesReduce<Right, [...Result, TEscape<Left>]> : [...Result, TEscape<Pointer>]);
type TIndices<Pointer extends string, Result extends string[] = Pointer extends '' ? [] : IndicesReduce<Pointer>> = Result;
type TResolve<Value extends unknown, Indices extends string[]> = (Indices extends [infer Left extends string, ...infer Right extends string[]] ? Left extends keyof Value ? TResolve<Value[Left], Right> : undefined : Value);
/** Type Level RFC 6901 Json Pointer Resolver */
type XPointerGet<Value extends unknown, Pointer extends string, Indices extends string[] = TIndices<Pointer>, Result extends unknown = TResolve<Value, Indices>> = Result;

type XCyclicCheck<Stack extends unknown[], MaxLength extends number, Buffer extends unknown[] = []> = (Stack extends [infer Left, ...infer Right] ? Buffer['length'] extends MaxLength ? false : XCyclicCheck<Right, MaxLength, [...Buffer, Left]> : true);
type XCyclicGuard<Stack extends unknown[], Ref extends string> = (Ref extends Stack[number] ? XCyclicCheck<Stack, 2> : true);
type XNormal<Pointer extends string, Result extends string = (Pointer extends `#${infer Rest extends string}` ? Rest : Pointer)> = Result;
type XStaticRef<Stack extends string[], Root extends XSchema, Ref extends string, Normal extends string = XNormal<Ref>, Target extends unknown = XPointerGet<Root, Normal>, Schema extends XSchema = Target extends XSchema ? Target : {}, Result extends unknown = (XCyclicGuard<Stack, Ref> extends true ? XStaticSchema<[...Stack, Ref], Root, Schema> : any)> = Result;

type XStaticRequired<_Stack extends string[], _Root extends XSchema, Schema extends XSchema, Keys extends string[], Result extends Record<PropertyKey, unknown> = Schema extends XProperties ? {} : Record<Keys[number], unknown>> = Result;

type XFromTypeNames<TypeNames extends string[], Result extends unknown = never> = (TypeNames extends readonly [infer Left extends string, ...infer Right extends string[]] ? XFromTypeNames<Right, Result | XFromTypeName<Left>> : Result);
type XFromTypeName<TypeName extends string> = (TypeName extends 'object' ? object : TypeName extends 'array' ? {} : TypeName extends 'boolean' ? boolean : TypeName extends 'integer' ? number : TypeName extends 'number' ? number : TypeName extends 'null' ? null : TypeName extends 'string' ? string : TypeName extends 'bigint' ? bigint : TypeName extends 'symbol' ? symbol : TypeName extends 'undefined' ? undefined : TypeName extends 'void' ? void : TypeName extends 'asyncIterator' ? {} : TypeName extends 'constructor' ? {} : TypeName extends 'function' ? {} : TypeName extends 'iterator' ? {} : unknown);
type XStaticType<TypeName extends string[] | string> = (TypeName extends string[] ? XFromTypeNames<TypeName> : TypeName extends string ? XFromTypeName<TypeName> : unknown);

type XStaticUnevaluatedProperties<Stack extends string[], Root extends XSchema, Schema extends XSchema, Result extends Record<PropertyKey, unknown> = (Schema extends true ? {
    [key: string]: unknown;
} : Schema extends false ? {} : {
    [key: string]: XStaticSchema<Stack, Root, Schema>;
})> = Result;

type XFromKeywords<Stack extends string[], Root extends XSchema, Schema extends XSchema, Result extends unknown[] = [
    Schema extends XAdditionalProperties<infer Type extends XSchema> ? XStaticAdditionalProperties<Stack, Root, Type> : unknown,
    Schema extends XAllOf<infer Types extends XSchema[]> ? XStaticAllOf<Stack, Root, Types> : unknown,
    Schema extends XAnyOf<infer Types extends XSchema[]> ? XStaticAnyOf<Stack, Root, Types> : unknown,
    Schema extends XConst<infer Value extends unknown> ? XStaticConst<Value> : unknown,
    Schema extends XIf<infer Type extends XSchema> ? XStaticIf<Stack, Root, Schema, Type> : unknown,
    Schema extends XEnum<infer Values extends unknown[]> ? XStaticEnum<Values> : unknown,
    Schema extends XItems<infer Types extends XSchema[] | XSchema> ? XStaticItems<Stack, Root, Schema, Types> : unknown,
    Schema extends XOneOf<infer Types extends XSchema[]> ? XStaticOneOf<Stack, Root, Types> : unknown,
    Schema extends XPatternProperties<infer Properties extends Record<PropertyKey, XSchema>> ? XStaticPatternProperties<Stack, Root, Properties> : unknown,
    Schema extends XPrefixItems<infer Types extends XSchema[]> ? XStaticPrefixItems<Stack, Root, Schema, Types> : unknown,
    Schema extends XProperties<infer Properties extends Record<PropertyKey, XSchema>> ? XStaticProperties<Stack, Root, Schema, Properties> : unknown,
    Schema extends XPropertyNames<infer Type extends XSchema> ? XStaticPropertyNames<Stack, Root, Type> : unknown,
    Schema extends XRef<infer Ref extends string> ? XStaticRef<Stack, Root, Ref> : unknown,
    Schema extends XRequired<infer Keys extends string[]> ? XStaticRequired<Stack, Root, Schema, Keys> : unknown,
    Schema extends XType<infer TypeName extends string[] | string> ? XStaticType<TypeName> : unknown,
    Schema extends XUnevaluatedProperties<infer Type extends XSchema> ? XStaticUnevaluatedProperties<Stack, Root, Type> : unknown
]> = Result;
type XKeywordsIntersected<Schemas extends unknown[], Result extends unknown = unknown> = (Schemas extends [infer Left extends unknown, ...infer Right extends unknown[]] ? XKeywordsIntersected<Right, Result & Left> : Result);
type XKeywordsEvaluated<Schema extends unknown, Result extends unknown = Schema extends object ? {
    [Key in keyof Schema]: Schema[Key];
} : Schema> = Result;
type XStaticObject<Stack extends string[], Root extends XSchema, Schema extends XSchema, Keywords extends unknown[] = XFromKeywords<Stack, Root, Schema>, Intersected extends unknown = XKeywordsIntersected<Keywords>, Evaluated extends unknown = XKeywordsEvaluated<Intersected>> = Evaluated;
type XStaticBoolean<Schema extends boolean, Result extends unknown = Schema extends false ? never : unknown> = Result;
type XStaticSchema<Stack extends string[], Root extends XSchema, Schema extends XSchema, Result extends unknown = Schema extends boolean ? XStaticBoolean<Schema> : XStaticObject<Stack, Root, Schema>> = Result;

type XStatic<Value extends unknown, Schema extends XSchema = Value extends XSchema ? Value : {}, Canonical extends XSchema = XCanonical<Schema>, Result extends unknown = XStaticSchema<[], Canonical, Canonical>> = Result;

type StaticEvaluate<T> = {
    [K in keyof T]: T[K];
} & {};
type StaticDirection = 'Encode' | 'Decode';
type StaticType<Stack extends string[], Direction extends StaticDirection, Context extends TProperties, This extends TProperties, Type extends TSchema> = (Type extends TCodec<infer Type extends TSchema, infer Decoded extends unknown> ? StaticCodec<Stack, Direction, Context, This, Type, Decoded> : Type extends TAny ? StaticAny : Type extends TArray<infer Items extends TSchema> ? StaticArray<Stack, Direction, Context, This, Type, Items> : Type extends TBigInt ? StaticBigInt : Type extends TBoolean ? StaticBoolean : Type extends TConstructor<infer Parameters extends TSchema[], infer ReturnType extends TSchema> ? StaticConstructor<Stack, Direction, Context, This, Parameters, ReturnType> : Type extends TEnum<infer Values extends TEnumValue[]> ? StaticEnum<Values> : Type extends TFunction<infer Parameters extends TSchema[], infer ReturnType extends TSchema> ? StaticFunction<Stack, Direction, Context, This, Parameters, ReturnType> : Type extends TDependent<infer If extends TSchema, infer Then extends TSchema, infer Else extends TSchema> ? StaticDependent<Stack, Direction, Context, This, If, Then, Else> : Type extends TInteger ? StaticInteger : Type extends TIntersect<infer Types extends TSchema[]> ? StaticIntersect<Stack, Direction, Context, This, Types> : Type extends TLiteral<infer Value extends TLiteralValue> ? StaticLiteral<Value> : Type extends TNever ? StaticNever : Type extends TNull ? StaticNull : Type extends TNumber ? StaticNumber : Type extends TObject<infer Properties extends TProperties> ? StaticObject<Stack, Direction, Context, This, Properties> : Type extends TRecord<infer Key extends string, infer Value extends TSchema> ? StaticRecord<Stack, Direction, Context, This, Key, Value> : Type extends TCyclic<infer Defs extends TProperties, infer Ref extends string> ? StaticCyclic<Stack, Direction, Context, This, Defs, Ref> : Type extends TRef<infer Ref extends string> ? StaticRef<Stack, Direction, Context, This, Ref> : Type extends TString ? StaticString : Type extends TSymbol ? StaticSymbol : Type extends TTemplateLiteral<infer Pattern extends string> ? StaticTemplateLiteral<Pattern> : Type extends TThis ? StaticThis<Stack, Direction, Context, This> : Type extends TTuple<infer Items extends TSchema[]> ? StaticTuple<Stack, Direction, Context, This, Type, Items> : Type extends TUndefined ? StaticUndefined : Type extends TUnion<infer Types extends TSchema[]> ? StaticUnion<Stack, Direction, Context, This, Types> : Type extends TUnknown ? StaticUnknown : Type extends TUnsafe<infer Type extends unknown> ? StaticUnsafe<Type> : Type extends TVoid ? StaticVoid : XStatic<Type>);
/** Infers a static type from a TypeBox type. */
type Static<Type extends TSchema, Context extends TProperties = {}, Result extends unknown = StaticType<[], 'Encode', Context, {}, Type>> = Result;

type ReadonlyOptionalKeys<Properties extends TProperties, Result extends PropertyKey = {
    [Key in keyof Properties]: Properties[Key] extends TReadonly<TSchema> ? (Properties[Key] extends TOptional<Properties[Key]> ? Key : never) : never;
}[keyof Properties]> = Result;
type ReadonlyKeys<Properties extends TProperties, Result extends PropertyKey = {
    [Key in keyof Properties]: Properties[Key] extends TReadonly<TSchema> ? (Properties[Key] extends TOptional<Properties[Key]> ? never : Key) : never;
}[keyof Properties]> = Result;
type OptionalKeys<Properties extends TProperties, Result extends PropertyKey = {
    [Key in keyof Properties]: Properties[Key] extends TOptional<TSchema> ? (Properties[Key] extends TReadonly<Properties[Key]> ? never : Key) : never;
}[keyof Properties]> = Result;
type RequiredKeys<Properties extends TProperties, Result extends PropertyKey = keyof Omit<Properties, ReadonlyOptionalKeys<Properties> | ReadonlyKeys<Properties> | OptionalKeys<Properties>>> = Result;
type StaticPropertiesWithModifiers<Properties extends TProperties, PropertiesWithoutModifiers extends Record<PropertyKey, unknown>> = StaticEvaluate<Readonly<Partial<Pick<PropertiesWithoutModifiers, ReadonlyOptionalKeys<Properties>>>> & Readonly<Pick<PropertiesWithoutModifiers, ReadonlyKeys<Properties>>> & Partial<Pick<PropertiesWithoutModifiers, OptionalKeys<Properties>>> & Required<Pick<PropertiesWithoutModifiers, RequiredKeys<Properties>>>>;
type StaticPropertiesWithoutModifiers<Stack extends string[], Direction extends StaticDirection, Context extends TProperties, This extends TProperties, Properties extends TProperties, Result extends Record<PropertyKey, unknown> = {
    [Key in keyof Properties]: StaticType<Stack, Direction, Context, This, Properties[Key]>;
}> = Result;
type StaticProperties<Stack extends string[], Direction extends StaticDirection, Context extends TProperties, This extends TProperties, Properties extends TProperties, PropertiesWithoutModifiers extends Record<PropertyKey, unknown> = StaticPropertiesWithoutModifiers<Stack, Direction, Context, This, Properties>, PropertiesWithModifiers extends Record<PropertyKey, unknown> = StaticPropertiesWithModifiers<Properties, PropertiesWithoutModifiers>, Result extends Record<PropertyKey, unknown> = {
    [Key in keyof PropertiesWithModifiers]: PropertiesWithModifiers[Key];
}> = Result;
/** Represents a Record<PropertyKey, TSchema> structure. */
interface TProperties extends TSchema {
    [key: PropertyKey]: TSchema;
}
/** Creates a RequiredArray derived from the given TProperties value. */
type TRequiredArray<Properties extends TProperties, RequiredProperties extends TProperties = {
    [Key in keyof Properties as Properties[Key] extends TOptional<Properties[Key]> ? never : Key]: Properties[Key];
}, RequiredKeys extends string[] = TUnionToTuple<Extract<keyof RequiredProperties, string>>, Result extends string[] | undefined = RequiredKeys extends [] ? undefined : RequiredKeys> = Result;
type TKeyToString<Key extends number | string> = `${Key}`;
/** Extracts a tuple of keys from a TProperties value. */
type TPropertyKeys<Properties extends TProperties, ExtractKey extends number | string = Extract<keyof Properties, number | string>, StringKey extends string = TKeyToString<ExtractKey>, Result extends string[] = TUnionToTuple<StringKey>> = Result;
type TPropertyValuesReduce<Properties extends TProperties, Keys extends string[], Result extends TSchema[] = []> = Keys extends [infer Left extends string, ...infer Right extends string[]] ? Left extends keyof Properties ? TPropertyValuesReduce<Properties, Right, [...Result, Properties[Left]]> : TPropertyValuesReduce<Properties, Right, Result> : Result;
/** Extracts a tuple of property values from a TProperties value. */
type TPropertyValues<Properties extends TProperties, Keys extends string[] = TPropertyKeys<Properties>, Result extends TSchema[] = TPropertyValuesReduce<Properties, Keys>> = Result;

type TAddImmutableOperation<Type extends TSchema, Result extends TSchema = '~immutable' extends keyof Type ? Type : TImmutable<Type>> = Result;
type TAddImmutableAction<Type extends TSchema, Result extends TSchema = TAddImmutableOperation<Type>> = Result;
type TAddImmutableInstantiate<Context extends TProperties, State extends TState, Type extends TSchema, InstantiateType extends TSchema = TInstantiateType<Context, State, Type>> = TAddImmutableAction<InstantiateType>;

/** Applies an AddImmutable action to a type. */
type TAddImmutable<Type extends TSchema> = (TAddImmutableAction<Type>);

type AttributeValue = string | number | boolean | readonly string[] | readonly number[] | readonly boolean[];
interface SpanAttributes {
    [name: string]: AttributeValue | undefined;
}
interface SpanOptions {
    name: string;
    attributes?: SpanAttributes;
}
type SpanStatus = {
    status: "ok";
} | {
    status: "error";
    error?: {
        name: string;
        message: string;
    };
};
interface TelemetryContext {
    startSpan<T>(options: SpanOptions, callback: (span: TelemetrySpan) => T | Promise<T>): Promise<T>;
}
interface TelemetrySpan extends TelemetryContext {
    addEvent(name: string, attributes?: SpanAttributes): void;
    setAttributes(attributes: SpanAttributes): void;
    setStatus(status: SpanStatus): void;
}

/** Azure models ship without a baseUrl: one resource per user, resolved per request. */
interface AzureEndpointOptions extends StreamOptions {
    azureApiVersion?: string;
    azureResourceName?: string;
    azureBaseUrl?: string;
    azureDeploymentName?: string;
}

interface AzureOpenAIResponsesOptions extends AzureEndpointOptions {
    reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
    toolChoice?: ResponseCreateParamsStreaming["tool_choice"];
    reasoningSummary?: "auto" | "detailed" | "concise" | null;
}

type BedrockThinkingDisplay = "summarized" | "omitted";
interface BedrockOptions extends StreamOptions {
    region?: string;
    profile?: string;
    toolChoice?: "auto" | "any" | "none" | {
        type: "tool";
        name: string;
    };
    reasoning?: ThinkingLevel;
    thinkingBudgets?: ThinkingBudgets;
    interleavedThinking?: boolean;
    /**
     * Controls how Claude's thinking content is returned in responses.
     * - "summarized": Thinking blocks contain summarized thinking text (default here).
     * - "omitted": Thinking content is redacted but the signature still travels back
     *   for multi-turn continuity, reducing time-to-first-text-token.
     *
     * Note: Anthropic's API default for Claude Opus 4.8 and Mythos Preview is
     * "omitted". We default to "summarized" here to keep behavior consistent with
     * older Claude 4 models. Only applies to Claude models on Bedrock.
     */
    thinkingDisplay?: BedrockThinkingDisplay;
    /** Key-value pairs attached to the inference request for cost allocation tagging.
     * Keys: max 64 chars, no `aws:` prefix. Values: max 256 chars. Max 50 pairs.
     * Tags appear in AWS Cost Explorer split cost allocation data.
     * @see https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ConverseStream.html */
    requestMetadata?: Record<string, string>;
    /** Bearer token for Bedrock API key authentication.
     * When set, bypasses SigV4 signing and sends Authorization: Bearer <token> instead.
     * Requires `bedrock:CallWithBearerToken` IAM permission on the token's identity.
     * Set via AWS_BEARER_TOKEN_BEDROCK env var or pass directly.
     * @see https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazonbedrock.html */
    bearerToken?: string;
}

/**
 * Shared utilities for Google Generative AI and Google Vertex providers.
 */

/**
 * Thinking level for Gemini 3 models.
 * Mirrors Google's ThinkingLevel enum values.
 */
type GoogleApiThinkingLevel = "THINKING_LEVEL_UNSPECIFIED" | "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";

interface GoogleOptions extends StreamOptions {
    toolChoice?: "auto" | "none" | "any";
    thinking?: {
        enabled: boolean;
        budgetTokens?: number;
        level?: GoogleApiThinkingLevel;
    };
}

interface GoogleVertexOptions extends StreamOptions {
    toolChoice?: "auto" | "none" | "any";
    thinking?: {
        enabled: boolean;
        budgetTokens?: number;
        level?: GoogleApiThinkingLevel;
    };
    project?: string;
    location?: string;
}

/**
 * Provider-specific options for the Mistral API.
 */
type MistralReasoningEffort = "none" | "low" | "medium" | "high" | "max";
interface MistralOptions extends StreamOptions {
    toolChoice?: "auto" | "none" | "any" | "required" | {
        type: "function";
        function: {
            name: string;
        };
    };
    promptMode?: "reasoning";
    reasoningEffort?: MistralReasoningEffort;
}

interface OpenAICodexResponsesOptions extends StreamOptions {
    reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
    reasoningSummary?: "auto" | "concise" | "detailed" | "off" | "on" | null;
    serviceTier?: ResponseCreateParamsStreaming["service_tier"];
    textVerbosity?: "low" | "medium" | "high";
    toolChoice?: "auto" | "none" | "required";
}

interface OpenAICompletionsOptions extends StreamOptions {
    toolChoice?: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption;
    reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
    /** Token budgets per thinking level. Used when `compat.thinkingTokenBudgetField` or `compat.supportsThinkingTokenBudget` is set, or by `{ "$var": "thinking.budget" }`. */
    thinkingBudgets?: ThinkingBudgets;
}

interface OpenAIResponsesOptions extends StreamOptions {
    reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
    reasoningSummary?: "auto" | "detailed" | "concise" | null;
    serviceTier?: ResponseCreateParamsStreaming["service_tier"];
    toolChoice?: ResponseCreateParamsStreaming["tool_choice"];
}

/**
 * pi-messages API implementation.
 *
 * Streams pi's own message protocol directly to a backend: the request is a
 * single POST of `{ model, context, options }` to `<baseUrl>/messages`, the
 * response is an SSE stream of serialized assistant-message events plus a
 * terminal `done`/`error` event. This is the wire protocol spoken by the
 * Radius gateway, but any backend implementing it can be used, e.g. via a
 * models.json custom provider with `"api": "pi-messages"`.
 */

interface PiMessagesOptions extends StreamOptions {
    reasoning?: ThinkingLevel;
    toolChoice?: "auto" | "none" | "required" | {
        type: "function";
        function: {
            name: string;
        };
    };
    /** Ask the backend for debug metadata (e.g. routing response headers). */
    debug?: boolean;
}

declare const OpenAICompletionsCompatSchema: TObject<{
    supportsStore: TOptional<TBoolean>;
    supportsDeveloperRole: TOptional<TBoolean>;
    supportsReasoningEffort: TOptional<TBoolean>;
    supportsUsageInStreaming: TOptional<TBoolean>;
    supportsFinishReason: TOptional<TBoolean>;
    maxTokensField: TOptional<TUnion<[TLiteral<"max_completion_tokens">, TLiteral<"max_tokens">]>>;
    requiresToolResultName: TOptional<TBoolean>;
    requiresAssistantAfterToolResult: TOptional<TBoolean>;
    requiresThinkingAsText: TOptional<TBoolean>;
    requiresReasoningContentOnAssistantMessages: TOptional<TBoolean>;
    thinkingFormat: TOptional<TUnion<[TLiteral<"openai">, TLiteral<"openrouter">, TLiteral<"deepseek">, TLiteral<"together">, TLiteral<"baseten">, TLiteral<"zai">, TLiteral<"qwen">, TLiteral<"chat-template">, TLiteral<"qwen-chat-template">, TLiteral<"string-thinking">, TLiteral<"ant-ling">]>>;
    chatTemplateKwargs: TOptional<TRecord<"^.*$", TUnion<[TString, TNumber, TBoolean, TNull, TObject<{
        $var: TUnion<[TLiteral<"thinking.enabled">, TLiteral<"thinking.effort">, TLiteral<"thinking.budget">]>;
        omitWhenOff: TOptional<TBoolean>;
    }>]>>>;
    chatTemplateArgs: TOptional<TRecord<"^.*$", TUnion<[TString, TNumber, TBoolean, TNull, TObject<{
        $var: TUnion<[TLiteral<"thinking.enabled">, TLiteral<"thinking.effort">, TLiteral<"thinking.budget">]>;
        omitWhenOff: TOptional<TBoolean>;
    }>]>>>;
    openRouterRouting: TOptional<TObject<{
        allow_fallbacks: TOptional<TBoolean>;
        require_parameters: TOptional<TBoolean>;
        data_collection: TOptional<TUnion<[TLiteral<"deny">, TLiteral<"allow">]>>;
        zdr: TOptional<TBoolean>;
        enforce_distillable_text: TOptional<TBoolean>;
        order: TOptional<TArray<TString>>;
        only: TOptional<TArray<TString>>;
        ignore: TOptional<TArray<TString>>;
        quantizations: TOptional<TArray<TString>>;
        sort: TOptional<TUnion<[TString, TObject<{
            by: TOptional<TString>;
            partition: TOptional<TUnion<[TString, TNull]>>;
        }>]>>;
        max_price: TOptional<TObject<{
            prompt: TOptional<TUnion<[TNumber, TString]>>;
            completion: TOptional<TUnion<[TNumber, TString]>>;
            image: TOptional<TUnion<[TNumber, TString]>>;
            audio: TOptional<TUnion<[TNumber, TString]>>;
            request: TOptional<TUnion<[TNumber, TString]>>;
        }>>;
        preferred_min_throughput: TOptional<TUnion<[TNumber, TObject<{
            p50: TOptional<TNumber>;
            p75: TOptional<TNumber>;
            p90: TOptional<TNumber>;
            p99: TOptional<TNumber>;
        }>]>>;
        preferred_max_latency: TOptional<TUnion<[TNumber, TObject<{
            p50: TOptional<TNumber>;
            p75: TOptional<TNumber>;
            p90: TOptional<TNumber>;
            p99: TOptional<TNumber>;
        }>]>>;
    }>>;
    vercelGatewayRouting: TOptional<TObject<{
        only: TOptional<TArray<TString>>;
        order: TOptional<TArray<TString>>;
    }>>;
    zaiToolStream: TOptional<TBoolean>;
    thinkingTokenBudgetField: TOptional<TUnion<[TLiteral<"thinking_token_budget">, TLiteral<"thinking_budget">, TLiteral<"thinking_budget_tokens">]>>;
    supportsThinkingTokenBudget: TOptional<TBoolean>;
    supportsOpenAIGrammarTools: TOptional<TBoolean>;
    supportsMidConvoSystemMessages: TOptional<TBoolean>;
    supportsMidConvoToolAdditions: TOptional<TBoolean>;
    supportsStrictMode: TOptional<TBoolean>;
    cacheControlFormat: TOptional<TLiteral<"anthropic">>;
    sendSessionAffinityHeaders: TOptional<TBoolean>;
    sessionAffinityFormat: TOptional<TUnion<[TLiteral<"openai">, TLiteral<"openai-nosession">, TLiteral<"openrouter">]>>;
    supportsLongCacheRetention: TOptional<TBoolean>;
    vllmPriority: TOptional<TNumber>;
}>;
declare const OpenAIResponsesCompatSchema: TObject<{
    supportsDeveloperRole: TOptional<TBoolean>;
    supportsMidConvoSystemMessages: TOptional<TBoolean>;
    sessionAffinityFormat: TOptional<TUnion<[TLiteral<"openai">, TLiteral<"openai-nosession">, TLiteral<"openrouter">]>>;
    supportsLongCacheRetention: TOptional<TBoolean>;
    supportsStrictMode: TOptional<TBoolean>;
    supportsOpenAIGrammarTools: TOptional<TBoolean>;
    supportsAdditionalTools: TOptional<TBoolean>;
    supportsToolSearch: TOptional<TBoolean>;
    supportsExplicitPromptCacheMode: TOptional<TBoolean>;
    supportsMaxOutputTokens: TOptional<TBoolean>;
}>;
declare const AnthropicMessagesCompatSchema: TObject<{
    supportsEagerToolInputStreaming: TOptional<TBoolean>;
    supportsLongCacheRetention: TOptional<TBoolean>;
    sendSessionAffinityHeaders: TOptional<TBoolean>;
    sessionAffinityFormat: TOptional<TLiteral<"openrouter">>;
    supportsCacheControlOnTools: TOptional<TBoolean>;
    supportsTemperature: TOptional<TBoolean>;
    forceAdaptiveThinking: TOptional<TBoolean>;
    allowEmptySignature: TOptional<TBoolean>;
    supportsStrictTools: TOptional<TBoolean>;
    supportsMidConvoEffort: TOptional<TBoolean>;
    supportsMidConvoSystemMessages: TOptional<TBoolean>;
    supportsMidConvoToolChanges: TOptional<TBoolean>;
    allowedFallbackModels: TOptional<TArray<TObject<{
        provider: TString;
        model: TString;
        cost: TObject<{
            input: TNumber;
            output: TNumber;
            cacheRead: TNumber;
            cacheWrite: TNumber;
            tiers: TOptional<TArray<TObject<{
                input: TNumber;
                output: TNumber;
                cacheRead: TNumber;
                cacheWrite: TNumber;
                inputTokensAbove: TNumber;
            }>>>;
        }>;
    }>>>;
}>;
declare const BedrockCompatSchema: TObject<{
    supportsStrictMode: TOptional<TBoolean>;
}>;
declare const MistralConversationsCompatSchema: TObject<{
    supportsMidConvoSystemMessages: TOptional<TBoolean>;
}>;
/** Compatibility settings for OpenAI-compatible completions APIs. */
interface OpenAICompletionsCompat extends Static<typeof OpenAICompletionsCompatSchema> {
}
/** Compatibility settings for OpenAI Responses APIs. */
interface OpenAIResponsesCompat extends Static<typeof OpenAIResponsesCompatSchema> {
}
/** Compatibility settings for Anthropic Messages-compatible APIs. */
interface AnthropicMessagesCompat extends Static<typeof AnthropicMessagesCompatSchema> {
}
/** Compatibility settings for Amazon Bedrock models. */
interface BedrockCompat extends Static<typeof BedrockCompatSchema> {
}
/** Compatibility settings for the Mistral chat API. */
interface MistralConversationsCompat extends Static<typeof MistralConversationsCompatSchema> {
}

declare const ThinkingLevelSchema: TEnum<["minimal", "low", "medium", "high", "xhigh", "max"]>;
declare const ModelThinkingLevelSchema: TEnum<["off", "minimal", "low", "medium", "high", "xhigh", "max"]>;
declare const ModelInputModalitySchema: TEnum<["text", "image"]>;
declare const CacheRetentionSchema: TEnum<["none", "short", "long"]>;
declare const ThinkingLevelMapSchema: TObject<{
    high: TOptional<TUnion<[TString, TNull]>>;
    low: TOptional<TUnion<[TString, TNull]>>;
    max: TOptional<TUnion<[TString, TNull]>>;
    medium: TOptional<TUnion<[TString, TNull]>>;
    minimal: TOptional<TUnion<[TString, TNull]>>;
    off: TOptional<TUnion<[TString, TNull]>>;
    xhigh: TOptional<TUnion<[TString, TNull]>>;
}>;
declare const ModelPromptCacheSchema: TObject<{
    long: TOptional<TNumber>;
    short: TOptional<TNumber>;
}>;
declare const ModelCostSchema: TObject<{
    input: TNumber;
    output: TNumber;
    cacheRead: TNumber;
    cacheWrite: TNumber;
    tiers: TOptional<TArray<TObject<{
        input: TNumber;
        output: TNumber;
        cacheRead: TNumber;
        cacheWrite: TNumber;
        inputTokensAbove: TNumber;
    }>>>;
}>;
declare const ModelInputLimitsSchema: TObject<{
    maxRequestBytes: TOptional<TInteger>;
    images: TOptional<TObject<{
        resize: TOptional<TObject<{
            maxWidth: TOptional<TInteger>;
            maxHeight: TOptional<TInteger>;
            maxBytes: TOptional<TInteger>;
            jpegQuality: TOptional<TInteger>;
        }>>;
        maxPerMessage: TOptional<TInteger>;
        maxPerRequest: TOptional<TInteger>;
    }>>;
}>;
type ThinkingLevel = Static<typeof ThinkingLevelSchema>;
type ModelThinkingLevel = Static<typeof ModelThinkingLevelSchema>;
type ThinkingLevelMap = Static<typeof ThinkingLevelMapSchema>;
type ModelInputModality = Static<typeof ModelInputModalitySchema>;
type CacheRetention = Static<typeof CacheRetentionSchema>;
type ModelPromptCache = Static<typeof ModelPromptCacheSchema>;
type ModelCost = Static<typeof ModelCostSchema>;
type ModelInputLimits = Static<typeof ModelInputLimitsSchema>;

interface DiagnosticErrorInfo {
    name?: string;
    message: string;
    stack?: string;
    code?: string | number;
}
interface AssistantMessageDiagnostic {
    type: string;
    timestamp: number;
    error?: DiagnosticErrorInfo;
    details?: JsonObject;
}

declare class EventStream<T, R = T> implements AsyncIterable<T> {
    private queue;
    private waiting;
    protected done: boolean;
    private finalResultPromise;
    private resolveFinalResult;
    private isComplete;
    private extractResult;
    constructor(isComplete: (event: T) => boolean, extractResult: (event: T) => R);
    push(event: T): void;
    end(result?: R): void;
    [Symbol.asyncIterator](): AsyncIterator<T>;
    result(): Promise<R>;
}
/**
 * Event stream of one assistant response. It also times the response: the final message (`done` or `error` event, or
 * the result passed to `end()`) gets `durationMs`, measured with a monotonic clock from the stream's creation, unless
 * the message already has one or its `timestamp` predates the stream. A stream that forwards a response which started
 * elsewhere, such as a deferred result fetched later, therefore leaves it untimed.
 */
declare class AssistantMessageEventStream extends EventStream<AssistantMessageEvent, AssistantMessage> {
    #private;
    constructor();
    push(event: AssistantMessageEvent): void;
    end(result?: AssistantMessage): void;
}

type KnownApi = "openai-completions" | "mistral-conversations" | "openai-responses" | "azure-openai-responses" | "openai-codex-responses" | "anthropic-messages" | "bedrock-converse-stream" | "google-generative-ai" | "google-vertex" | "pi-messages";
type Api = KnownApi | (string & {});
type KnownImageApi = "openrouter-images";
type ImageApi = KnownImageApi | (string & {});
type KnownClassifierApi = "typesafe-system-one" | "cloudflare-workers-ai-system-one" | "llama-cpp-classify" | "openai-decisions";
type ClassifierApi = KnownClassifierApi | (string & {});
type KnownProvider = "amazon-bedrock" | "ant-ling" | "anthropic" | "google" | "google-vertex" | "openai" | "azure" | "openai-codex" | "radius" | "typesafe" | "nvidia" | "deepseek" | "github-copilot" | "xai" | "groq" | "cerebras" | "openrouter" | "vercel-ai-gateway" | "zai" | "zai-coding-cn" | "mistral" | "minimax" | "minimax-cn" | "moonshotai" | "moonshotai-cn" | "huggingface" | "fireworks" | "together" | "baseten" | "opencode" | "opencode-go" | "kimi-coding" | "meta" | "cloudflare-workers-ai" | "cloudflare-ai-gateway" | "qwen-token-plan" | "qwen-token-plan-cn" | "qwen-token-plan-individual" | "xiaomi" | "xiaomi-token-plan-cn" | "xiaomi-token-plan-ams" | "xiaomi-token-plan-sgp";
type ProviderId = KnownProvider | string;
type ToolChoice = "auto" | "none";
type SamplingParams = Record<string, unknown>;
type SamplingParamsByThinkingLevel = Partial<Record<ModelThinkingLevel, SamplingParams>>;
/** Token budgets for each thinking level (token-based providers only) */
interface ThinkingBudgets {
    minimal?: number;
    low?: number;
    medium?: number;
    high?: number;
}
type Transport = "sse" | "websocket" | "websocket-cached" | "auto";
/** Provider-scoped environment overrides. Values take precedence over process.env. */
type ProviderEnv = Record<string, string>;
type ProviderHeaders = Record<string, string | null>;
type FetchFunction = typeof globalThis.fetch;
interface ProviderResponse {
    status: number;
    headers: Record<string, string>;
}
/** Authentication, HTTP transport, and lifecycle callbacks shared by provider requests. */
interface ProviderRequestOptions<TModel = Model$1<Api>> {
    signal?: AbortSignal;
    /** Explicit parent context for telemetry produced by this logical request. */
    telemetryContext?: TelemetryContext;
    apiKey?: string;
    /**
     * Optional fetch implementation for provider HTTP requests.
     * Defaults to `globalThis.fetch`. Provider adapters that cannot inject a custom implementation may reject it.
     * This does not affect WebSocket transports.
     */
    fetch?: FetchFunction;
    /**
     * Provider-scoped environment values. These take precedence over process.env for
     * provider configuration such as regional settings, endpoint placeholders, and
     * proxy variables.
     */
    env?: ProviderEnv;
    /**
     * Optional callback for inspecting or replacing provider payloads before sending.
     * Return undefined to keep the payload unchanged.
     */
    onPayload?: (payload: unknown, model: TModel) => unknown | undefined | Promise<unknown | undefined>;
    /**
     * Optional callback invoked after an HTTP response is received.
     */
    onResponse?: (response: ProviderResponse, model: TModel) => void | Promise<void>;
    /**
     * Optional custom HTTP headers to include in API requests.
     * Merged with provider defaults; caller values override default headers.
     * On AWS Bedrock these are injected via a Smithy `build`-step middleware so
     * they are covered by SigV4 signing; reserved headers (`x-amz-*`,
     * `authorization`, `host`) are silently ignored to preserve SigV4 / bearer auth.
     * A null value suppresses a provider/API default header with the same name.
     */
    headers?: ProviderHeaders;
    /**
     * HTTP request timeout in milliseconds for providers/SDKs that support it.
     * For example, OpenAI and Anthropic SDK clients default to 10 minutes.
     */
    timeoutMs?: number;
    /**
     * Maximum retry attempts for providers/SDKs that support client-side retries.
     * For example, OpenAI and Anthropic SDK clients default to 2.
     */
    maxRetries?: number;
    /**
     * Maximum delay in milliseconds to wait for a retry when the server requests a long wait.
     * If the server's requested delay exceeds this value, the request fails immediately
     * with an error containing the requested delay, allowing higher-level retry logic
     * to handle it with user visibility.
     * Default: 60000 (60 seconds). Set to 0 to disable the cap.
     */
    maxRetryDelayMs?: number;
}
interface StreamOptions extends ProviderRequestOptions<Model$1<Api>> {
    /**
     * Optional callback invoked after an HTTP response is received and before
     * its body stream is consumed.
     */
    onResponse?: (response: ProviderResponse, model: Model$1<Api>) => void | Promise<void>;
    /**
     * Optional observer for each parsed provider stream event before Pi normalization.
     * Event data is adapter-owned and must be treated as read-only.
     * Adapter support is explicit; unsupported adapters do not invoke it.
     */
    onProviderStreamEvent?: (data: unknown, model: Model$1<Api>) => void | Promise<void>;
    temperature?: number;
    /**
     * Arbitrary sampling parameters merged into the request body as-is, after the named request
     * fields, so keys here override them. Lets custom OpenAI-compatible servers (llama.cpp, vLLM,
     * SGLang, ...) receive parameters pi does not model, e.g. `top_p`, `top_k`, `min_p`,
     * `repetition_penalty`. Merged over `Model.samplingParams` per key. Only applied by
     * OpenAI-compatible adapters (completions, responses, Azure responses); other APIs ignore it.
     */
    samplingParams?: SamplingParams;
    maxTokens?: number;
    /**
     * Preferred transport for providers that support multiple transports.
     * Providers that do not support this option ignore it.
     */
    transport?: Transport;
    /**
     * Prompt cache retention preference. Providers map this to their supported values.
     * Default: "short".
     */
    cacheRetention?: CacheRetention;
    /**
     * Optional session identifier for providers that support session-based caching.
     * Providers can use this to enable prompt caching, request routing, or other
     * session-aware features. Ignored by providers that don't support it.
     */
    sessionId?: string;
    /**
     * WebSocket connect timeout in milliseconds for providers that support
     * WebSocket transports. This covers the connection/open handshake only;
     * stream idleness after connection uses timeoutMs.
     */
    websocketConnectTimeoutMs?: number;
    /**
     * Optional metadata to include in API requests.
     * Providers extract the fields they understand and ignore the rest.
     * For example, Anthropic uses `user_id` for abuse tracking and rate limiting.
     */
    metadata?: Record<string, unknown>;
}
interface DeferredFetchOptions extends ProviderRequestOptions<Model$1<Api>> {
    /**
     * Maximum provider long-poll duration in milliseconds.
     * Defaults to 0, which performs one status check.
     */
    wait?: number;
}
/** Request options for best-effort deferred-response cancellation. */
type DeferredCancelOptions = ProviderRequestOptions<Model$1<Api>>;
/**
 * Maps known APIs to their full provider-specific stream option types.
 * Type-only imports from API implementation modules are erased at emit, so
 * this is tree-shake safe.
 */
interface ApiOptionsMap {
    "anthropic-messages": AnthropicOptions;
    "openai-completions": OpenAICompletionsOptions;
    "openai-responses": OpenAIResponsesOptions;
    "openai-codex-responses": OpenAICodexResponsesOptions;
    "azure-openai-responses": AzureOpenAIResponsesOptions;
    "google-generative-ai": GoogleOptions;
    "google-vertex": GoogleVertexOptions;
    "mistral-conversations": MistralOptions;
    "bedrock-converse-stream": BedrockOptions;
    "pi-messages": PiMessagesOptions;
}
/**
 * Full stream options for an API. Known APIs resolve to their concrete option
 * type; custom API strings fall back to the generic shape.
 */
type ApiStreamOptions<TApi extends Api> = TApi extends keyof ApiOptionsMap ? ApiOptionsMap[TApi] : StreamOptions & Record<string, unknown>;
interface ClassifierOptions extends ProviderRequestOptions<ClassifierModel<ClassifierApi>> {
    /**
     * Divides the answer logits by this value before they are normalized into probabilities.
     * Values above 1 soften the distribution; values below 1 sharpen it. Must be positive.
     * APIs that cannot apply it ignore it.
     */
    temperature?: number;
}
interface ImagesOptions extends ProviderRequestOptions<ImageModel<ImageApi>> {
    /**
     * Optional metadata to include in API requests.
     * Providers extract the fields they understand and ignore the rest.
     */
    metadata?: Record<string, unknown>;
}
interface SimpleStreamOptions extends StreamOptions {
    /** Provider-neutral tool selection for simple requests. When omitted, adapters use provider-specific behavior. */
    toolChoice?: ToolChoice;
    reasoning?: ThinkingLevel;
    /** Ask a capable provider to return a durable handle and continue the request asynchronously. */
    deferred?: boolean | {
        window?: "15m" | "1h" | "24h";
    };
    /** Custom token budgets for thinking levels (token-based providers only) */
    thinkingBudgets?: ThinkingBudgets;
}
type StreamFunction<TApi extends Api = Api, TOptions extends StreamOptions = StreamOptions> = (model: Model$1<TApi>, context: TranscriptContext, options?: TOptions) => AssistantMessageEventStream;
interface TextContent {
    type: "text";
    text: string;
    textSignature?: string;
}
interface ThinkingContent {
    type: "thinking";
    thinking: string;
    thinkingSignature?: string;
    /** When true, the thinking content was redacted by safety filters. The opaque
     *  encrypted payload is stored in `thinkingSignature` so it can be passed back
     *  to the API for multi-turn continuity. */
    redacted?: boolean;
}
interface ImageContent {
    type: "image";
    data: string;
    mimeType: string;
}
interface ToolCall {
    type: "toolCall";
    id: string;
    name: string;
    arguments: JsonObject;
    thoughtSignature?: string;
    /** OpenAI Responses namespace for calls to dynamically loaded or namespaced tools. */
    namespace?: string;
}
interface Usage {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    /** Subset of `cacheWrite` written with 1h retention. Only Anthropic reports this split. */
    cacheWrite1h?: number;
    /**
     * Reasoning/thinking tokens, when the provider reports them. This is a subset of
     * `output`: `output` already includes these tokens. Set to a number (possibly 0) by
     * providers that expose a reasoning breakdown; left undefined by providers that don't.
     */
    reasoning?: number;
    totalTokens: number;
    cost: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
        total: number;
    };
}
type StopReason = "pending" | "stop" | "length" | "toolUse" | "error" | "aborted" | "deferred";
type JsonValue = null | boolean | number | string | readonly JsonValue[] | JsonObject;
type JsonObject = {
    [key: string]: JsonValue;
};
type IsAny<T> = 0 extends 1 & T ? true : false;
type IsExactlyJsonValue<T> = [T] extends [JsonValue] ? ([JsonValue] extends [T] ? true : false) : false;
type IsJsonProperty<T> = IsAny<T> extends true ? false : unknown extends T ? false : [Exclude<T, undefined>] extends [never] ? true : IsJsonCompatible<Exclude<T, undefined>>;
type InvalidJsonKeys<T extends object> = {
    [TKey in keyof T]-?: TKey extends string | number ? (IsJsonProperty<T[TKey]> extends true ? never : TKey) : TKey;
}[keyof T];
type IsJsonCompatible<T> = IsAny<T> extends true ? false : unknown extends T ? false : IsExactlyJsonValue<T> extends true ? true : T extends null | boolean | number | string ? true : T extends undefined ? false : T extends readonly (infer TItem)[] ? IsJsonCompatible<TItem> : T extends (...args: never[]) => unknown ? false : T extends object ? [InvalidJsonKeys<T>] extends [never] ? true : false : false;
/** The JSON representation of a typed in-memory value. Optional object properties remain optional. */
type JsonRepresentation<T> = IsAny<T> extends true ? JsonValue : unknown extends T ? JsonValue : [T] extends [JsonValue] ? T : T extends readonly unknown[] ? {
    [TKey in keyof T]: JsonRepresentation<Exclude<T[TKey], undefined>>;
} : T extends object ? {
    [TKey in keyof T]: JsonRepresentation<Exclude<T[TKey], undefined>>;
} : never;
interface DeferredHandle {
    provider: string;
    modelId: string;
    api: string;
    /** Provider token, such as a response id or batch id plus row id. */
    id: string;
    expiresAt?: number;
    pollAfterMs?: number;
    /** Provider conversion data required to reconstruct the final assistant message. */
    data?: JsonValue;
}
/**
 * System instructions and tool declarations at one point in the transcript.
 *
 * The leading system message is the system prompt. Later system messages change it:
 * `content` adds instructions from that point on, `sections` replace or remove named
 * prompt sections, and `toolsAdded`/`toolsRemoved` change the tool set. Replaying
 * every system message in order yields the current prompt and tools. Providers that
 * accept system messages mid-conversation send each one in place; other providers
 * rebuild the leading system message from the replayed state.
 */
interface SystemMessage {
    role: "system";
    /** Instruction text. On the leading message this is the base prompt; later, additional instructions. */
    content: string | TextContent[];
    /**
     * Named, ordered prompt sections rendered verbatim after `content`. The leading message
     * declares them; later messages replace sections by name, and `null` removes one. Keep
     * each section self-delimiting (a tag, a heading) so the model can relate an update to
     * the original. Avoid integer-like names; JSON objects reorder those.
     */
    sections?: Record<string, string | null>;
    /** Complete definitions of tools that become available at this point. */
    toolsAdded?: Tool[];
    /** Tools that stop being available at this point. */
    toolsRemoved?: ToolReference[];
    timestamp: number;
}
interface UserMessage {
    role: "user";
    content: string | (TextContent | ImageContent)[];
    timestamp: number;
}
interface AssistantMessage {
    role: "assistant";
    content: (TextContent | ThinkingContent | ToolCall)[];
    api: Api;
    provider: ProviderId;
    model: string;
    responseModel?: string;
    responseId?: string;
    /** Exact provider-native effort level used for this response. Absent for legacy or unmanaged responses. */
    providerThinkingLevel?: string;
    /** Pi thinking level the agent loop requested for this response. Absent outside the agent loop and for legacy responses. */
    thinkingLevel?: ModelThinkingLevel;
    diagnostics?: AssistantMessageDiagnostic[];
    usage: Usage;
    stopReason: StopReason;
    deferred?: DeferredHandle;
    errorMessage?: string;
    rawStopReason?: string;
    /**
     * Provider indication of whether the model explicitly ended its turn.
     * Preserved for debugging and does not currently affect agent control flow.
     */
    endTurn?: boolean;
    /** Unix timestamp in milliseconds when the request started. */
    timestamp: number;
    /**
     * Milliseconds from `timestamp` until the response ended, measured with a monotonic clock. Set by
     * `AssistantMessageEventStream` on the final message of a response it saw start; absent for legacy messages and
     * for deferred results fetched later.
     */
    durationMs?: number;
}
/** A tool call that another tool made while it ran, for example from a codemode script. */
interface NestedToolCallRecord {
    id: string;
    name: string;
    /** Omitted when over the size limits; `argumentsBytes` then gives their size. */
    arguments?: JsonObject;
    /** UTF-8 size of the arguments as JSON, set when `arguments` is omitted. */
    argumentsBytes?: number;
    /** `unfinished`: the call was still running when the calling tool finished. */
    status: "ok" | "error" | "unfinished";
    durationMs?: number;
    /** Error text, truncated. */
    error?: string;
}
/** Bounded record of the nested calls a tool made. Results are not recorded. */
interface NestedToolCalls {
    calls: NestedToolCallRecord[];
    /** False when calls were dropped, arguments omitted, or calls had not finished. */
    complete: boolean;
}
type ToolResultMessage<TDetails = JsonValue> = IsJsonCompatible<TDetails> extends true ? {
    role: "toolResult";
    toolCallId: string;
    toolName: string;
    content: (TextContent | ImageContent)[];
    details?: JsonRepresentation<TDetails>;
    /** Usage from the tool execution itself, if available. Not part of main LLM context accounting. */
    usage?: Usage;
    /** Calls this tool made to other tools. Kept for the session record; not sent to the model. */
    nestedCalls?: NestedToolCalls;
    isError: boolean;
    /** Unix timestamp in milliseconds when the result was created. */
    timestamp: number;
    /** Milliseconds the tool's execution took, measured with a monotonic clock. Absent for legacy results. */
    durationMs?: number;
} : never;
type Message = SystemMessage | UserMessage | AssistantMessage | ToolResultMessage;
type ImagesInputContent = TextContent | ImageContent;
type ImagesOutputContent = TextContent | ImageContent;
interface ImagesContext {
    input: ImagesInputContent[];
}
type ImagesStopReason = "stop" | "error" | "aborted";
interface AssistantImages {
    api: ImageApi;
    provider: ProviderId;
    model: string;
    output: ImagesOutputContent[];
    responseId?: string;
    usage?: Usage;
    stopReason: ImagesStopReason;
    errorMessage?: string;
    timestamp: number;
}
interface ClassifierChoiceQuestion {
    type: "choice";
    instructions: string;
    criteria: Record<string, string>;
}
interface ClassifierScoreQuestion {
    type: "score";
    instructions: string;
    criteria: string[];
}
interface ClassifierBoolQuestion {
    type: "bool";
    instructions: string;
    criteria: {
        true: string;
        false: string;
    };
}
type ClassifierQuestion = ClassifierChoiceQuestion | ClassifierScoreQuestion | ClassifierBoolQuestion;
interface ClassifierContext {
    state: JsonObject;
    /**
     * Images judged together with `state`. Only models whose `input` includes `"image"` accept them;
     * other models return an error result.
     */
    images?: ImageContent[];
    questions: Record<string, ClassifierQuestion>;
}
interface ClassifierChoiceAnswer {
    type: "choice";
    choice: string;
    probabilities: Record<string, number>;
    confidence: number;
}
interface ClassifierScoreAnswer {
    type: "score";
    score: number;
    confidence: number;
}
interface ClassifierBoolAnswer {
    type: "bool";
    probability: number;
}
type ClassifierAnswer = ClassifierChoiceAnswer | ClassifierScoreAnswer | ClassifierBoolAnswer;
type ClassifierStopReason = "stop" | "error" | "aborted";
interface ClassifierResult {
    api: ClassifierApi;
    provider: ProviderId;
    model: string;
    answers: Record<string, ClassifierAnswer>;
    /** Token usage and its cost at the model's catalog price, when the service reports token counts. */
    usage?: Usage;
    stopReason: ClassifierStopReason;
    errorMessage?: string;
    timestamp: number;
}

/** OpenAI grammar variants for constrained sampling. */
type GrammarFormat = "openai_lark" | "openai_regex";
type GrammarVariants = Partial<Record<GrammarFormat, string>>;
/**
 * Optional provider-side constrained sampling configs for a tool.
 *
 * The `json_schema` value roughly maps to the concept of `strict` in APIs which is
 * implemented as json-schema constrained sampling by APIs. Grammar variants let
 * callers provide provider-specific encodings of the same intended language.
 */
type ConstrainedSamplingConfig = {
    type: "json_schema";
    strict: "prefer" | "require";
} | {
    type: "grammar";
    variants: GrammarVariants;
};
interface Tool<TParameters extends TSchema = TSchema> {
    name: string;
    description: string;
    parameters: TParameters;
    constrainedSampling?: false | ConstrainedSamplingConfig;
}
interface ToolReference {
    name: string;
}
/**
 * Request input accepted by the public stream entry points (`Models.stream()`,
 * `streamSimple()`, ...). `systemPrompt` and `tools` are shorthand for a leading
 * system message; `normalizeContext()` folds them into one before the request
 * reaches a provider.
 */
interface Context$1 {
    systemPrompt?: string;
    messages: Message[];
    tools?: Tool[];
}
declare const transcriptContextBrand: unique symbol;
/**
 * Normalized request context passed to providers and API implementations. The
 * prompt and tool declarations are carried by the transcript's system messages.
 * Only `normalizeContext()` produces this type, so a raw `Context` cannot reach
 * provider code by accident.
 */
type TranscriptContext = {
    messages: Message[];
    readonly [transcriptContextBrand]: true;
};
/**
 * Event protocol for AssistantMessageEventStream.
 *
 * Successful streams emit `start` before partial updates and terminate with
 * `done`. A stream may terminate directly with `error` when request setup fails
 * before generation starts; after `start`, failures also terminate with `error`.
 * Direct `streamSimple()` calls throw synchronously when request auth is missing.
 * Updates and `done` must never appear before `start`.
 *
 * `partial` is the shared live response-so-far helper, not an event-time
 * snapshot. Text and thinking blocks are empty when their `*_start` event is
 * emitted and grow only through their corresponding `*_delta` events until the
 * authoritative `*_end`. Redacted thinking may be complete at start and emit no
 * deltas. Tool-call arguments at `toolcall_start` are provider-specific;
 * `toolcall_delta` carries subsequent JSON updates.
 */
type AssistantMessageEvent = {
    type: "start";
    partial: AssistantMessage;
} | {
    type: "text_start";
    contentIndex: number;
    partial: AssistantMessage;
} | {
    type: "text_delta";
    contentIndex: number;
    delta: string;
    partial: AssistantMessage;
} | {
    type: "text_end";
    contentIndex: number;
    content: string;
    partial: AssistantMessage;
} | {
    type: "thinking_start";
    contentIndex: number;
    partial: AssistantMessage;
} | {
    type: "thinking_delta";
    contentIndex: number;
    delta: string;
    partial: AssistantMessage;
} | {
    type: "thinking_end";
    contentIndex: number;
    content: string;
    partial: AssistantMessage;
} | {
    type: "toolcall_start";
    contentIndex: number;
    partial: AssistantMessage;
} | {
    type: "toolcall_delta";
    contentIndex: number;
    delta: string;
    partial: AssistantMessage;
} | {
    type: "toolcall_end";
    contentIndex: number;
    toolCall: ToolCall;
    partial: AssistantMessage;
} | {
    type: "done";
    reason: Extract<StopReason, "stop" | "length" | "toolUse" | "deferred">;
    message: AssistantMessage;
} | {
    type: "error";
    reason: Extract<StopReason, "aborted" | "error">;
    error: AssistantMessage;
};
/** Fields shared by every catalog entry, regardless of what you can do with it. */
interface BaseModel<TApi extends string> {
    id: string;
    name: string;
    api: TApi;
    provider: ProviderId;
    baseUrl: string;
    input: ModelInputModality[];
    /** Provider input limits and cache-safe preprocessing metadata. */
    inputLimits?: ModelInputLimits;
    cost: ModelCost;
    headers?: Record<string, string>;
}
/** Chat model: usable with `stream()` and friends. */
interface Model$1<TApi extends Api> extends BaseModel<TApi> {
    /**
     * Optional: chat is the default model type, so models without `type` are chat
     * models. Narrow mixed model lists with `isModelType()` instead of comparing
     * `type` directly.
     */
    type?: "chat";
    reasoning: boolean;
    /**
     * Maps pi thinking levels to provider/model-specific values.
     * Missing keys use provider defaults. null marks a level as unsupported.
     */
    thinkingLevelMap?: ThinkingLevelMap;
    /** Prompt cache lifetimes per retention tier. Unset when the provider's cache behavior is unknown. */
    promptCache?: ModelPromptCache;
    contextWindow: number;
    maxTokens: number;
    /** Default sampling parameters for this model. See {@link StreamOptions.samplingParams}; per-request keys override these. */
    samplingParams?: SamplingParams;
    /** Sampling parameter overrides selected by the effective pi thinking level. */
    samplingParamsByThinkingLevel?: SamplingParamsByThinkingLevel;
    /** Compatibility overrides for OpenAI-compatible APIs. If not set, auto-detected from baseUrl. */
    compat?: TApi extends "openai-completions" ? OpenAICompletionsCompat : TApi extends "openai-responses" | "azure-openai-responses" | "openai-codex-responses" ? OpenAIResponsesCompat : TApi extends "anthropic-messages" ? AnthropicMessagesCompat : TApi extends "bedrock-converse-stream" ? BedrockCompat : TApi extends "mistral-conversations" ? MistralConversationsCompat : never;
}
/** Image-generation model: usable with `generateImages()` only. */
interface ImageModel<TApi extends ImageApi> extends BaseModel<TApi> {
    type: "image";
    /** Output modalities. Always includes `"image"`; `"text"` means the model can also return text blocks. */
    output: ("text" | "image")[];
}
/** Structured classifier model: usable with `classify()` only. */
interface ClassifierModel<TApi extends ClassifierApi> extends BaseModel<TApi> {
    type: "classifier";
    contextWindow: number;
}
/** Model shape for each model type. */
interface ModelTypeMap {
    chat: Model$1<Api>;
    image: ImageModel<ImageApi>;
    classifier: ClassifierModel<ClassifierApi>;
}
/** What a catalog entry is for. Decides which `Models` operation accepts it. */
type ModelType = keyof ModelTypeMap;
/** Anything a provider can list. Narrow with `isModelType()`. */
type AnyModel = ModelTypeMap[ModelType];

type AnthropicEffort = "low" | "medium" | "high" | "xhigh" | "max";
type AnthropicThinkingDisplay = "summarized" | "omitted";
interface AnthropicOptions extends StreamOptions {
    /**
     * Enable extended thinking.
     * For adaptive thinking models: the model decides when/how much to think.
     * For older models: uses budget-based thinking with thinkingBudgetTokens.
     * Default: undefined (thinking is omitted unless `streamSimple()` maps
     * a simple reasoning level to this option, or callers set it explicitly).
     */
    thinkingEnabled?: boolean;
    /**
     * Token budget for extended thinking (older models only).
     * Ignored for adaptive thinking models.
     * Default: 1024 when `thinkingEnabled` is true and no budget is provided.
     */
    thinkingBudgetTokens?: number;
    /**
     * Effort level for adaptive thinking models.
     * Controls how much thinking Claude allocates:
     * - "max": Always thinks with no constraints (Opus 4.6 only)
     * - "xhigh": Highest reasoning level (Opus 4.7+, Fable 5)
     * - "high": Always thinks, deep reasoning
     * - "medium": Moderate thinking, may skip for simple queries
     * - "low": Minimal thinking, skips for simple tasks
     * Ignored for older models.
     * Default: omitted unless `streamSimple()` maps a simple reasoning
     * level to this option.
     */
    effort?: AnthropicEffort;
    /**
     * Controls how thinking content is returned in API responses.
     * - "summarized": Thinking blocks contain summarized thinking text.
     * - "omitted": Thinking blocks return an empty thinking field; the encrypted
     *   signature still travels back for multi-turn continuity. Use for faster
     *   time-to-first-text-token when your UI does not surface thinking.
     *
     * Note: Anthropic's API default for Claude Opus 4.7 and Claude Mythos Preview
     * is "omitted". We default to "summarized" here to keep behavior consistent
     * with older Claude 4 models. Set this explicitly to "omitted" to opt in.
     * Default: "summarized" when thinking is enabled.
     */
    thinkingDisplay?: AnthropicThinkingDisplay;
    /**
     * Whether to request the interleaved thinking beta header for non-adaptive
     * thinking models. Adaptive thinking models have interleaved thinking built in,
     * so the header is skipped for them regardless of this setting.
     * Default: true.
     */
    interleavedThinking?: boolean;
    /**
     * Anthropic tool choice behavior. String values map to Anthropic's built-in
     * choices; `{ type: "tool", name }` forces a specific tool.
     * Default: omitted (Anthropic default behavior, currently equivalent to auto).
     */
    toolChoice?: "auto" | "any" | "none" | {
        type: "tool";
        name: string;
    };
    /**
     * Pre-built Anthropic client instance. When provided, skips internal client
     * construction entirely. Use this to inject alternative SDK clients such as
     * `AnthropicVertex` that shares the same messaging API.
     */
    client?: Anthropic;
}

/**
 * Request auth for a single model request. If a value cannot be expressed as
 * `apiKey`, `headers`, or `baseUrl`, it is provider config, not auth.
 */
interface ModelAuth {
    apiKey?: string;
    headers?: ProviderHeaders;
    baseUrl?: string;
}
/**
 * Stored api-key credential. `env` holds provider-scoped environment/config
 * values such as Cloudflare account/gateway ids.
 */
interface ApiKeyCredential {
    type: "api_key";
    key?: string;
    env?: ProviderEnv;
}
/** OAuth token data returned by extension compatibility flows. */
interface OAuthCredentials {
    refresh: string;
    access: string;
    expires: number;
    [key: string]: unknown;
}
/** Stored canonical OAuth credential. */
interface OAuthCredential extends OAuthCredentials {
    type: "oauth";
}
/** One type-tagged credential per provider — the shape of today's auth.json. */
type Credential = ApiKeyCredential | OAuthCredential;
/** Environment access for auth resolution. Injectable for tests and browsers. */
interface AuthContext {
    env(name: string): Promise<string | undefined>;
    /** Check whether a file exists. Supports a leading `~`. Always false in browsers. */
    fileExists(path: string): Promise<boolean>;
}
/** Result of resolving auth for a model. */
interface AuthResult {
    auth: ModelAuth;
    /** Provider-scoped environment/config values resolved from credentials and ambient context. */
    env?: ProviderEnv;
    /** Human-readable label for status UI: "ANTHROPIC_API_KEY", "OAuth", "~/.aws/credentials". */
    source?: string;
}
interface AuthCheck {
    source?: string;
    type: "api_key" | "oauth";
}
/**
 * Prompt shown to the user during login. `signal` lets the flow cancel a
 * pending prompt when an out-of-band event resolves the step, e.g. a
 * `manual_code` prompt raced against a callback server, aborted when the
 * callback wins.
 */
type AuthPrompt = {
    signal?: AbortSignal;
} & ({
    type: "text";
    message: string;
    placeholder?: string;
} | {
    type: "secret";
    message: string;
    placeholder?: string;
} | {
    type: "select";
    message: string;
    options: readonly {
        id: string;
        label: string;
        description?: string;
    }[];
} | {
    type: "manual_code";
    message: string;
    placeholder?: string;
});
interface AuthInfoLink {
    url: string;
    label?: string;
}
type AuthEvent = {
    type: "info";
    message: string;
    links?: readonly AuthInfoLink[];
} | {
    type: "auth_url";
    url: string;
    instructions?: string;
} | {
    type: "device_code";
    userCode: string;
    verificationUri: string;
    intervalSeconds?: number;
    expiresInSeconds?: number;
} | {
    type: "progress";
    message: string;
};
/**
 * Login interaction callbacks serving both api-key and OAuth flows.
 *
 * `prompt()` returns the entered/selected string (`select` returns the option
 * id). Rejects on cancel/abort. `signal` aborts the whole login flow;
 * per-prompt cancellation uses `AuthPrompt.signal`.
 */
interface AuthInteraction {
    signal?: AbortSignal;
    prompt(prompt: AuthPrompt): Promise<string>;
    notify(event: AuthEvent): void;
}
/** Normalized interaction passed to provider login implementations. */
type ProviderAuthInteraction = AuthInteraction & {
    signal: AbortSignal;
};
/**
 * Api-key auth: stored key/provider env plus ambient sources (env vars, AWS
 * profiles, ADC files). Ambient-only providers omit `login`.
 */
interface ApiKeyAuth {
    /** Display name, e.g. "Anthropic API key". */
    name: string;
    /** Interactive setup (prompt for key/provider env). Absent = ambient-only. */
    login?(interaction: ProviderAuthInteraction): Promise<ApiKeyCredential>;
    /**
     * Optional side-effect-free availability check. Use this when `resolve()` may
     * execute commands or perform other request-time work. Missing means Models
     * checks availability by resolving auth.
     */
    check?(input: {
        ctx: AuthContext;
        credential?: ApiKeyCredential;
        signal: AbortSignal;
    }): Promise<AuthCheck | undefined>;
    /**
     * Resolve auth from the stored credential and/or ambient sources, merging
     * per field (`credential.key ?? env("...")`, `credential.env?.NAME ?? env("...")`).
     * undefined = not configured. Resolution is provider-scoped; model-specific
     * endpoint preparation happens after auth has been resolved.
     */
    resolve(input: {
        ctx: AuthContext;
        credential?: ApiKeyCredential;
        signal: AbortSignal;
    }): Promise<AuthResult | undefined>;
}
/** App-supplied context for `Models.login`. */
interface LoginOptions {
    /**
     * Returns the stable ID of this app installation, e.g. sent to OpenAI as its
     * agent host ID. Called only by login flows that need it, so apps can create
     * the ID on first use and must return the same ID on every later call.
     */
    getDeviceId?: () => string;
    /**
     * Name this app introduces itself with during login, e.g. OpenAI's agent name hint and
     * Codex originator. Defaults to pi's own name.
     */
    agentName?: string;
}
/**
 * OAuth auth. The `refresh`/`toAuth` split lets `Models` own the locked
 * refresh pattern: `refresh` produces a credential, `toAuth` derives request
 * auth from whatever credential ends up stored.
 */
interface OAuthAuth {
    /** Display name, e.g. "Anthropic (Claude Pro/Max)". */
    name: string;
    /** Whether access through this auth method is backed by a provider subscription. */
    isSubscription?: boolean;
    /** Selector label for the OAuth login option, e.g. "Sign in with SuperGrok or X Premium". */
    loginLabel?: string;
    login(interaction: ProviderAuthInteraction, options?: LoginOptions): Promise<OAuthCredential>;
    /**
     * Exchange the refresh token. Network call; throws on failure
     * (invalid_grant etc.). `Models` runs this under the store lock.
     */
    refresh(credential: OAuthCredential, signal: AbortSignal): Promise<OAuthCredential>;
    /**
     * Side-effect-free derivation of request auth from a valid credential.
     * Covers per-credential baseUrl (GitHub Copilot). Async so lazy wrappers
     * can load the implementation on first use.
     */
    toAuth(credential: OAuthCredential): Promise<ModelAuth>;
}
/**
 * Provider auth. At least one of `apiKey`/`oauth` must be present: even
 * ambient-credential providers and keyless local servers provide `apiKey`
 * auth whose `resolve()` reports whether the provider is configured.
 */
interface ProviderAuth {
    apiKey?: ApiKeyAuth;
    oauth?: OAuthAuth;
}

interface ModelsStoreEntry {
    /** Persisted models of every type. */
    models: readonly AnyModel[];
    /** Unix timestamp from the remote catalog's Last-Modified header. */
    lastModified?: number;
    /** Unix timestamp of the last completed remote check. */
    checkedAt?: number;
    /**
     * Opaque validator from the remote catalog's ETag header, stored verbatim
     * (quotes included) and echoed back as If-None-Match.
     */
    etag?: string;
}

interface ModelsPublication {
    /** Provider-selected persisted catalog. Omit to leave storage unchanged; null deletes it. */
    persist?: ModelsStoreEntry | null;
    /** Optional synchronous update of provider-private in-memory catalog state. */
    update?: () => void;
}
interface RefreshModelsContext {
    /** Effective configured credential. OAuth credentials are refreshed before network access. */
    credential?: Credential;
    /** Immutable provider-scoped catalog snapshot captured before this refresh phase. */
    stored?: Readonly<ModelsStoreEntry>;
    /**
     * Generation-checked publication. Persistence policy remains provider-owned;
     * the update runs synchronously only after the selected persistence mutation.
     */
    publish(publication: ModelsPublication): Promise<boolean>;
    /** False during offline/cache-only initialization. */
    allowNetwork: boolean;
    /** Bypass provider freshness checks and fetch immediately when network access is allowed. */
    force?: boolean;
    /** Always present, including when the public refresh caller omits its optional signal. */
    signal: AbortSignal;
    /**
     * Base URL of the registered provider, including configuration overrides that wrappers apply
     * outside the provider receiving this context.
     */
    baseUrl?: string;
}
/** Any model a provider with chat APIs `TApi` can list. */
type ProviderModel<TApi extends Api> = Model$1<TApi> | ImageModel<ImageApi> | ClassifierModel<ClassifierApi>;
/**
 * A provider is the concrete runtime unit. It owns id/name/base metadata,
 * auth methods, model listing, and the operations its models support
 * (streaming, image generation, classification).
 *
 * `TApi` lets concrete provider factories declare which chat APIs their models
 * use (e.g. `openaiProvider(): Provider<"openai-responses" | "openai-completions">`),
 * giving typed chat model lists to direct factory users. Other model types use
 * their operation-specific API unions. Inside a `Models` collection providers
 * are held as `Provider<Api>`.
 */
interface Provider<TApi extends Api = Api> {
    readonly id: string;
    readonly name: string;
    readonly baseUrl?: string;
    readonly headers?: ProviderHeaders;
    /**
     * Required: at least one of `apiKey`/`oauth`. Every provider has auth
     * semantics — even providers with only ambient credentials (env vars, AWS
     * profiles, ADC files) and keyless local servers provide `apiKey` auth
     * whose `resolve()` reports whether the provider is configured.
     * `Models.getAuth()` returns undefined when the provider is unconfigured.
     */
    readonly auth: ProviderAuth;
    /**
     * Current known chat models, sync. Static providers return their catalog;
     * dynamic providers return the list as of the last `refreshModels()` (empty
     * before the first). Must not throw; `Models` treats a throwing
     * implementation as having no models.
     */
    getModels(): readonly Model$1<TApi>[];
    /**
     * Current known models of every type, sync, with the same contract as
     * `getModels()`. Providers with only chat models may omit it; `Models` then
     * uses `getModels()`. Model ids are unique within each type; one upstream
     * model may have separate entries for different operations.
     */
    getAllModels?(): readonly ProviderModel<TApi>[];
    /**
     * Dynamic providers only: restore `context.stored` and optionally fetch a newer list using
     * the effective credential. Implementations retain their previous list on failure, publish
     * persistence and synchronous state changes through `context.publish()`, and honor the
     * shared abort signal for blocking work.
     */
    refreshModels?(context: RefreshModelsContext): Promise<void>;
    /**
     * Optional provider policy for credential-specific model availability.
     * `getModels()` remains the complete synchronous chat catalog; `Models.getAvailable()`
     * applies this filter after confirming that provider auth is configured.
     */
    filterModels?(models: readonly Model$1<TApi>[], credential: Credential | undefined): readonly Model$1<TApi>[];
    /**
     * Optional credential-specific availability policy across every model type.
     * Without it, `Models.getAllAvailable()` applies `filterModels` to chat models
     * and keeps every other model.
     */
    filterAllModels?(models: readonly ProviderModel<TApi>[], credential: Credential | undefined): readonly ProviderModel<TApi>[];
    /** Stream a normalized transcript. `Models` normalizes the caller's `Context` before dispatching here. */
    stream<T extends TApi>(model: Model$1<T>, context: TranscriptContext, options?: ApiStreamOptions<T>): AssistantMessageEventStream;
    streamSimple(model: Model$1<TApi>, context: TranscriptContext, options?: SimpleStreamOptions): AssistantMessageEventStream;
    fetchDeferred?(model: Model$1<TApi>, handle: DeferredHandle, options?: DeferredFetchOptions): AssistantMessageEventStream;
    cancelDeferred?(model: Model$1<TApi>, handle: DeferredHandle, options?: DeferredCancelOptions): Promise<void>;
    /** Present when the provider supports dedicated image models. Never rejects. */
    generateImages?(model: ImageModel<ImageApi>, context: ImagesContext, options?: ImagesOptions): Promise<AssistantImages>;
    /** Present when the provider supports structured classifier models. Never rejects. */
    classify?(model: ClassifierModel<ClassifierApi>, context: ClassifierContext, options?: ClassifierOptions): Promise<ClassifierResult>;
}

/** Settings discovery includes lifecycle data that the host's generic model DTO omits. */

interface GoModel {
    id: string;
    name?: string;
    contextWindow?: number;
    maxTokens?: number;
    /** Token budget controls available to this model, including their catalog bounds. */
    reasoningBudget?: ThinkingBudgetRange;
    deprecated?: boolean;
    releaseDate?: string;
    /** Input modalities models.dev declares, in {@link INPUT_MODALITIES} order. */
    inputModalities?: readonly InputModality[];
    /** Advertised by the gateway but lacking a usable protocol and capability configuration. */
    configurationMissing?: boolean;
}
interface ThinkingBudgetRange {
    min: number;
    max: number;
}
/**
 * Input modalities this page can name. models.dev uses these same five tokens, so
 * an unknown token is dropped rather than rendered as an untranslatable chip.
 */
declare const INPUT_MODALITIES: readonly ["text", "image", "audio", "video", "pdf"];
type InputModality = typeof INPUT_MODALITIES[number];
/** Last successful check of one catalog source, plus any current refresh failure. */
interface GoCatalogSourceStatus {
    readonly updatedAt?: number;
    readonly error?: string;
    readonly warning?: string;
}
/** A failed refresh retains the Host's usable data with an explicit diagnostic. */
interface GoModelCatalog {
    readonly models: readonly GoModel[];
    readonly stale: boolean;
    readonly error?: string;
    /** Optional for clients reading an older Host response. Timestamps are Unix milliseconds. */
    readonly sources?: {
        readonly listing: GoCatalogSourceStatus;
        readonly metadata: GoCatalogSourceStatus;
    };
}
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface TypertRemoteNamespaceMap {
        opencodeGoModels: {
            read(): Promise<RemoteResult<GoModelCatalog>>;
        };
    }
}

/** Public SDK types are bundled at build time, alongside the private implementation. */

/** User controls are independent of the SDK's internal level used to enable a switch. */
type Model<TApi extends Api> = Model$1<TApi> & {
    reasoningControl?: 'toggle' | 'effort' | 'budget';
    reasoningBudget?: ThinkingBudgetRange;
    reasoningBudgetPresets?: readonly number[];
};

export type { Api, AssistantMessage, AssistantMessageEvent, Context$1 as Context, ImageContent, Message, Model, ModelCost, ModelThinkingLevel, Provider, SimpleStreamOptions, StreamFunction, TextContent, ThinkingBudgets, ThinkingLevelMap, Tool, ToolCall, Usage };
