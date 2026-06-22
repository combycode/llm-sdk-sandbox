/** A saved "chat member" — a model you can address by @name in the prompt. */
export interface ChatMember {
  /** Full model id, "provider/slug". */
  model: string;
  /** Short @-mention handle, unique across members. Editable. */
  name: string;
}
