import Mustache from "mustache";
import type OpenAI from "openai";
import type { z } from "zod";
import { zodToJsonSchema } from 'zod-to-json-schema';
import { parseUntilJson } from "./parseUntilJson";

export class ChatPromptTemplateNew {
  protected template = "";
  protected llm: OpenAI | null = null;
  protected variables: string[] | null = null;
  protected invokeFn: (...params: any) => string = () => { return "" }

  constructor(params: {
    template: string;
    inputVariables: string[];
    templateFormat?: "mustache";
  }) {
    this.template = params.template;
    this.variables = params.inputVariables;
  }

  public static fromTemplate(template: string): ChatPromptTemplateNew {
    // Extract mustache-style variables from the template
    const variableRegex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
    const variables: string[] = [];
    let match: RegExpExecArray | null = variableRegex.exec(template);
    while (match !== null) {
      variables.push(match[1] ?? "");
      match = variableRegex.exec(template);
    }
    const instance = new ChatPromptTemplateNew({
      template,
      inputVariables: variables,
    });
    instance.template = template;
    return instance;
  }

  public pipe(llm: OpenAI): this;
  public pipe(invokeFn: (...args: any[]) => string): this;
  public pipe(arg: OpenAI | ((...args: any) => string)): this {
    if (typeof arg === "function") {
      // You can store the postProcessFn for later use if needed
      // For now, just return this to allow chaining
      // Example: this.postProcessFn = arg;
      this.invokeFn = arg;
      return this;
    } else {
      this.llm = arg;
      return this;
    }
  }

  public format(params: Record<string, any>) {
    const paramsInVariables = Object.fromEntries(
      Object.keys(params)
        .filter((key) => (this.variables ?? []).includes(key))
        .map((key) => [key, params[key]]),
    );
    const finalTemplate = Mustache.render(this.template, paramsInVariables);
    return finalTemplate;
  }

  public async invoke(model: string, params: Record<string, any>) {
    let finalTemplate = this.format(params);

    if (!!this.invokeFn) {
      finalTemplate = this.invokeFn(finalTemplate);
    }

    if (!this.llm) {
      throw new Error("Cannot invoke without initializing with an LLM Object.");
    }

    return this.llm.chat.completions.create({
      model,
      messages: [{ content: finalTemplate, role: "user", name: "user" }],
    });
  }
}

export function getStructuredOutput<T extends z.ZodTypeAny>(schema: T): (data: any) => string {
  const templateStr = `You must format your output as a JSON value that adheres to a given "JSON Schema" instance.

	"JSON Schema" is a declarative language that allows you to annotate and validate JSON documents.

	For example, the example "JSON Schema" instance {{"properties": {{"foo": {{"description": "a list of test words", "type": "array", "items": {{"type": "string"}}}}}}, "required": ["foo"]}}}}
	would match an object with one required property, "foo". The "type" property specifies "foo" must be an "array", and the "description" property semantically describes it as "a list of test words". The items within "foo" must be strings.
	Thus, the object {{"foo": ["bar", "baz"]}} is a well-formatted instance of this example "JSON Schema". The object {{"properties": {{"foo": ["bar", "baz"]}}}} is not well-formatted.

	Your output will be parsed and type-checked according to the provided schema instance, so make sure all fields in your output match the schema exactly and there are no trailing commas!

	Here is the JSON Schema instance your output must adhere to. Include the enclosing markdown codeblock:
	\`\`\`json
	${JSON.stringify(zodToJsonSchema(schema))}
	\`\`\`

	The given data is:
	\`\`\`
	{{data}}
	\`\`\`
	`;

  return (data: any) => Mustache.render(templateStr, { data: JSON.stringify(data) });
}

export function getValidatedOutput<T extends z.ZodTypeAny>(schema: T, data: string) {
  const parsedData = parseUntilJson(data);

  return schema.safeParse(parsedData);
}