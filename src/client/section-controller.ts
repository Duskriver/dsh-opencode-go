/**
 * The OpenCode Go settings page's staged form over the `llm-opencode-go`
 * settings namespace, plus the gateway model listing the page reports.
 *
 * The key is the one control that does not live in the section: its literal
 * never rides a response, so the page learns only whether one is configured
 * and writes it through the credentials domain, addressed by the reference the
 * section names. It is still staged with the rest of the form, so one save
 * covers everything the page shows.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the ctx.remote merge into this program.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-settings-controller/remote'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  StagedForm,
  booleanField,
  numberField,
  textField,
  type FieldState,
  type FormActions,
  type FormShell,
} from './staged-form.ts'

/** Namespace of the OpenCode Go adapter. Spelled here rather than imported: a client package must not depend on a Host package. */
export const OPENCODE_GO_NS = 'llm-opencode-go'

/** Credential reference the provider resolves when the section names none. */
const DEFAULT_API_KEY_REF = 'OPENCODE_API_KEY'

/** Form field the credential control stages under. */
const API_KEY_FIELD = 'apiKey'

/**
 * Route the Host's model discovery answers for, spelled here for the same
 * reason as {@link OPENCODE_GO_NS}: a client package must not depend on a Host
 * package.
 */
const OPENCODE_GO_PROVIDER = 'opencode-go'

/** How many model names the page previews out of the whole listing. */
const MODEL_PREVIEW_LIMIT = 6

/** The adapter fields this page edits. */
export interface OpencodeGoSettings {
  /** Whether the adapter serves its route; false withdraws it from every picker. */
  enabled?: boolean
  /** Credential reference naming the environment key. */
  apiKeyEnv?: string
  /** The gateway endpoint; also the live listing base. */
  baseURL?: string
  /** Live catalog re-resolution interval, in minutes. */
  refreshMinutes?: number
  /** Largest idle gap between stream events, in milliseconds. */
  streamIdleTimeoutMs?: number
  /** Accumulated base64 image payload bound for one request. */
  maxRequestImageBytes?: number
  /** Total-pixel budget for one request image. */
  requestImagePixelBudget?: number
  /** Raw encoded-byte target for one request image. */
  requestImageMaxBytes?: number
}

/** What the credentials domain last reported, and for which reference. */
interface CredentialState {
  /** Reference this answer describes; a stale response for another one is dropped. */
  ref: string
  /** Whether any layer supplies a value for it. */
  configured: boolean
  /** Whether `credentials/set` can affect it; false disables the control. */
  writable: boolean
}

/** The gateway's model listing as the page reports it. */
export type OpencodeGoModels =
  /** Not asked for yet; the page asks once it mounts. */
  | { readonly status: 'idle' }
  /** A listing request is outstanding. */
  | { readonly status: 'loading' }
  /** The gateway answered: how many models it serves, and a preview of their names. */
  | { readonly status: 'ready'; readonly count: number; readonly preview: readonly string[] }
  /** The listing could not be read; `message` is the Host's own diagnostic. */
  | { readonly status: 'failed'; readonly message: string }

/** What the settings page renders. */
export interface OpencodeGoSectionState extends FormShell {
  /**
   * Whether the adapter currently serves its route. Resolved from the section
   * rather than staged: the switch writes on the click that flips it, because
   * a withdrawn route is what the user is trying to observe.
   */
  enabled: boolean
  /** Credential reference naming the environment key. */
  apiKeyEnv: FieldState
  /** The gateway endpoint. */
  baseURL: FieldState
  /** Live catalog re-resolution interval, in minutes. */
  refreshMinutes: FieldState
  /** Largest idle gap between stream events, in milliseconds. */
  streamIdleTimeoutMs: FieldState
  /** Accumulated base64 image payload bound for one request. */
  maxRequestImageBytes: FieldState
  /** Total-pixel budget for one request image. */
  requestImagePixelBudget: FieldState
  /** Raw encoded-byte target for one request image. */
  requestImageMaxBytes: FieldState
  /** The staged credential, which starts blank on every load. */
  apiKey: FieldState
  /** Whether the Host reports a credential configured for the referenced key. */
  apiKeyConfigured: boolean
  /** Whether the credentials domain accepts a write for it; false disables the control. */
  apiKeyWritable: boolean
  /** The gateway's current model listing. */
  models: OpencodeGoModels
}

/** The registration-side face the page's slot entry injects. */
export interface OpencodeGoSectionFace extends FormActions {
  hooks: {
    /** Page snapshot bound by the UI renderer as useOpencodeGo. */
    opencodeGo: SnapshotStore<OpencodeGoSectionState>
  }
  /** Read the gateway's model listing, now or again after a failure. */
  loadModels: () => void
  /**
   * Turn the adapter's route on or off, writing immediately.
   * @param next - the state the switch asks for.
   */
  setEnabled: (next: boolean) => void
}

/** Bridges the `llm-opencode-go` scope and the credentials domain onto the page. */
export class OpencodeGoSectionController {
  private readonly form: StagedForm
  private readonly store: SnapshotStore<OpencodeGoSectionState>
  private credential: CredentialState = { ref: '', configured: false, writable: true }
  private models: OpencodeGoModels = { status: 'idle' }
  private modelsRequest = 0
  private face: OpencodeGoSectionFace | undefined

  /**
   * @param scope - the bound settings scope for the `llm-opencode-go` namespace.
   * @param ctx - the page plugin's context, whose `remote.credentials` namespace
   *   answers for the credential the section references.
   */
  constructor(
    private readonly scope: SettingsScope<OpencodeGoSettings>,
    private readonly ctx: ClientContext,
  ) {
    this.form = new StagedForm(
      scope as SettingsScope<Record<string, unknown>>,
      [
        // Present so the shared override/reset machinery tracks the field; the
        // page's switch writes it directly instead of staging it.
        booleanField('enabled'),
        textField('apiKeyEnv'),
        textField('baseURL'),
        numberField('refreshMinutes'),
        numberField('streamIdleTimeoutMs'),
        numberField('maxRequestImageBytes'),
        numberField('requestImagePixelBudget'),
        numberField('requestImageMaxBytes'),
      ],
      [{ field: API_KEY_FIELD, write: text => this.writeKey(text) }],
    )
    this.store = this.form.bind(() => this.projection())
    scope.subscribe(() => { void this.readCredential() })
    void this.readCredential()
  }

  private projection(): OpencodeGoSectionState {
    return {
      ...this.form.shell(),
      enabled: this.enabled(),
      apiKeyEnv: this.form.field('apiKeyEnv'),
      baseURL: this.form.field('baseURL'),
      refreshMinutes: this.form.field('refreshMinutes'),
      streamIdleTimeoutMs: this.form.field('streamIdleTimeoutMs'),
      maxRequestImageBytes: this.form.field('maxRequestImageBytes'),
      requestImagePixelBudget: this.form.field('requestImagePixelBudget'),
      requestImageMaxBytes: this.form.field('requestImageMaxBytes'),
      apiKey: this.form.field(API_KEY_FIELD),
      apiKeyConfigured: this.credential.configured,
      apiKeyWritable: this.credential.writable,
      models: this.models,
    }
  }

  /**
   * The adapter's effective switch state: the resolved section's value, over
   * the Host's own default when the section carries none.
   * @returns whether the route is currently served.
   */
  private enabled(): boolean {
    return this.scope.getSnapshot().value?.enabled ?? true
  }

  /**
   * Flip the switch by writing the field on the click itself.
   *
   * This is the one control on the page that does not wait for Save: the point
   * of turning it off is to watch the models leave the pickers, and the point
   * of turning it back on is to use the route again — staging either behind a
   * second gesture would report a state the Host does not hold. The write is
   * revision-fenced by the scope like every other, and a refusal surfaces as a
   * failed save through the shared shell rather than a silent revert.
   * @param next - the state the switch asks for.
   */
  setEnabled(next: boolean): void {
    void this.scope.set('enabled', next)
  }

  /**
   * Read the gateway's model listing through the Host's discovery for this
   * adapter. Called when the page mounts and again from its refresh control.
   * A rejection settles as a failure too: the refresh control is disabled
   * while loading and the next read starts only from `idle`, so leaving the
   * state loading would strand the page with no way to ask the gateway again.
   */
  loadModels(): void {
    const request = ++this.modelsRequest
    this.models = { status: 'loading' }
    this.store.set(this.projection())
    // A later read owns the page: an answer or rejection for an earlier one
    // would report a listing the user already replaced.
    void this.ctx.remote.llm.discoverModels(OPENCODE_GO_NS, { provider: OPENCODE_GO_PROVIDER })
      .then((response) => {
        if (request !== this.modelsRequest) return
        this.models = response.ok
          ? {
            status: 'ready',
            count: response.value.length,
            preview: response.value.slice(0, MODEL_PREVIEW_LIMIT).map(model => model.name ?? model.id),
          }
          : { status: 'failed', message: response.error.message }
        this.store.set(this.projection())
      })
      .catch((error: unknown) => {
        if (request !== this.modelsRequest) return
        this.models = { status: 'failed', message: error instanceof Error ? error.message : String(error) }
        this.store.set(this.projection())
      })
  }

  /**
   * Ask the credentials domain about the reference the section currently names.
   *
   * The answer is stored with the reference it describes: `apiKeyEnv` can
   * change between the request and its response, and two reads can settle out
   * of order, so a response is published only while it still answers for the
   * reference in force.
   */
  private async readCredential(): Promise<void> {
    const ref = refOf(this.scope.getSnapshot())
    if (ref !== this.credential.ref) {
      // A new reference knows nothing yet; keeping the old answer would claim
      // the key is configured under a name nobody has checked.
      this.credential = { ref, configured: false, writable: true }
      this.store.set(this.projection())
    }
    const response = await this.ctx.remote.credentials.describe([ref])
    if (!response.ok || ref !== refOf(this.scope.getSnapshot())) return
    const view = response.value[ref]
    const next: CredentialState = {
      ref,
      configured: view?.configured ?? false,
      // An unknown reference is treated as writable: the control stays usable
      // and the Host is what refuses, rather than the page guessing a refusal.
      writable: view?.writable ?? true,
    }
    if (next.configured === this.credential.configured && next.writable === this.credential.writable) return
    this.credential = next
    this.store.set(this.projection())
  }

  /**
   * Re-read after the Host reports a change to the reference this page watches.
   *
   * A key can be written from somewhere else — the Models page addresses the
   * same reference — and the settings section does not change when it is, so
   * without this the badge keeps reporting a state the Host already replaced.
   * @param ref - the reference the Host reports as changed.
   */
  refreshCredential(ref: string): void {
    if (ref !== this.credential.ref) return
    void this.readCredential()
  }

  /**
   * Build the face the page's slot registration injects. Built once: the store
   * is what changes, and the renderer binds the same callbacks across renders.
   * @returns the page snapshot and its form actions.
   */
  inject(): OpencodeGoSectionFace {
    this.face ??= {
      hooks: { opencodeGo: this.store },
      loadModels: () => { this.loadModels() },
      setEnabled: (next) => { this.setEnabled(next) },
      ...this.form.actions(),
    }
    return this.face
  }

  /**
   * Write the staged key, then re-read whether the Host now holds one.
   * @param value - the staged credential literal.
   * @returns whether the Host reports a configured credential afterwards.
   */
  private async writeKey(value: string): Promise<boolean> {
    // Refusals surface through the re-read below: the Host is the only
    // authority on whether the key now exists.
    await this.ctx.remote.credentials.set(refOf(this.scope.getSnapshot()), value)
    await this.readCredential()
    return this.credential.configured
  }
}

/**
 * The credential reference the section names, or the provider's default.
 * @param snapshot - the current scope snapshot.
 * @returns the reference to address.
 */
function refOf(snapshot: SettingsScopeSnapshot<OpencodeGoSettings>): string {
  const declared = snapshot.value?.apiKeyEnv
  return declared !== undefined && declared.length > 0 ? declared : DEFAULT_API_KEY_REF
}
