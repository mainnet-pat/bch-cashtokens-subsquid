import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, BigIntColumn as BigIntColumn_, ManyToOne as ManyToOne_, Index as Index_} from "@subsquid/typeorm-store"
import {type Token} from "./token.model.js"
import {type TokenHolder} from "./tokenHolder.model.js"

@Entity_()
export class Utxo {
    constructor(props?: Partial<Utxo>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    tokenId!: string

    @BigIntColumn_({nullable: false})
    amount!: bigint

    @StringColumn_({nullable: true})
    commitment!: string | undefined | null

    @StringColumn_({nullable: true})
    capability!: string | undefined | null

    @StringColumn_({nullable: false})
    address!: string

    @Index_()
    @ManyToOne_('Token', {nullable: true})
    token!: Token

    @Index_()
    @ManyToOne_('TokenHolder', {nullable: true})
    holder!: TokenHolder
}
