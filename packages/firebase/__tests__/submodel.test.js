import { expect } from 'chai';
import {
    Model,
    Submodel,
    runTransaction,
} from '../lib/firestore';
import clearEmulatorData from './utilities/clear-emulator-data';
import freeAppResources from './utilities/free-app-resources';
import setUpEmulator from './utilities/set-up-emulator';
import {
    assign,
    omit,
    map
} from 'lodash';
import {
    where,
    orderBy,
} from 'firebase/firestore';
import { Deferred } from '../../async/lib';

describe('Submodel', () => {

    before(async () => {
        await setUpEmulator();
    });

    beforeEach(async () => {
        await clearEmulatorData();
    });

    after(() => {
        freeAppResources();
    });

    it('can write a document to a submodel with proper sanitization, and then fetch the written doc', async () => {
        const ProfileModel = new Model({
            collectionName: 'profiles',
            collectionProps: [
                'displayName',
                'agreedToTerms',
            ]
        });
        
        const ProfileEmailsModel = new Submodel({
            collectionName: 'emails',
            parent: ProfileModel,
            collectionProps: [
                'address',
                'domain',
            ]
        });

        const johnGmail = await ProfileEmailsModel.writeToNewDoc(
            'profiles/john/emails',
            {
                address: 'john@gmail.com',
                domain: 'gmail'
            }
        );

        let test = await ProfileEmailsModel.getByPath('profiles/john/emails/' + johnGmail.id);
        test = omit(test, ['_ref', 'id', 'subcollections']);
        expect(test).to.deep.equal({
            address: 'john@gmail.com',
            domain: 'gmail'
        });
    });

    it('can write a document to a subcollection instance with default values merged in', async () => {
        const ProfileModel = new Model({
            collectionName: 'profiles',
            collectionProps: [ 'displayName' ]
        });

        const ProfileEmailsModel = new Submodel({
            collectionName: 'emails',
            parent: ProfileModel,
            collectionProps: [
                'address',
                'isValid',
            ],
            propDefaults: {
                isValid: true
            }
        });

        const johnGmail = await ProfileEmailsModel.writeToPath(
            'profiles/john/emails/gmail',
            {
                address: 'john@gmail.com'
            },
            { mergeWithDefaultValues: true }
        );

        let test = await ProfileEmailsModel.getByPath('profiles/john/emails/gmail');
        test = omit(test, ['_ref', 'subcollections']);
        expect(test).to.deep.equal({
            id: 'gmail',
            address: 'john@gmail.com',
            isValid: true
        });
    });

    it('can query for data within a subcolleciton instance with compound queries', async () => {
        const ProfileModel = new Model({
            collectionName: 'profiles',
            collectionProps: [ 'displayName' ]
        });

        const ProfileEmailsModel = new Submodel({
            collectionName: 'emails',
            parent: ProfileModel,
            collectionProps: [
                'address',
                'domain',
                'isValid'
            ]
        });

        await Promise.all([
            ProfileEmailsModel.writeToNewDoc(
                'profiles/john/emails',
                {
                    address: 'john1@gmail.com',
                    domain: 'gmail',
                    isValid: true
                }
            ),
            ProfileEmailsModel.writeToNewDoc(
                'profiles/john/emails',
                {
                    address: 'john2@gmail.com',
                    domain: 'gmail',
                    isValid: true
                }
            ),
            ProfileEmailsModel.writeToNewDoc(
                'profiles/john/emails',
                {
                    address: 'john3@gmail.com',
                    domain: 'gmail',
                    isValid: false
                }
            ),
            ProfileEmailsModel.writeToNewDoc(
                'profiles/john/emails',
                {
                    address: 'john4@yahoo.com',
                    domain: 'yahoo',
                    isValid: true
                }
            ),
            ProfileEmailsModel.writeToNewDoc(
                'profiles/john/emails',
                {
                    address: 'john5@yahoo.com',
                    domain: 'yahoo',
                    isValid: false
                }
            ),
        ]);

        let result = await ProfileEmailsModel.getByQueryInInstance(
            'profiles/john/emails',
            [
                where('domain', '==', 'gmail'),
                where('isValid', '==', true),
                orderBy('address'),
            ]
        );
        result = map(result, resultValue => omit(resultValue, ['_ref', 'id', 'subcollections']));
        expect(result).to.deep.equal([
            {
                address: 'john1@gmail.com',
                domain: 'gmail',
                isValid: true,
            },
            {
                address: 'john2@gmail.com',
                domain: 'gmail',
                isValid: true
            }
        ]);
    });

    it('can create a new document in a subcollection without any default props merged in', async () => {
        const ProfileModel = new Model({
            collectionName: 'profiles',
            collectionProps: [ 'displayName' ]
        });

        const ProfileEmailsModel = new Submodel({
            collectionName: 'emails',
            parent: ProfileModel,
            collectionProps: [
                'address',
                'isValid',
            ],
            propDefaults: {
                address: 'No Address',
                isValid: true
            }
        });

        const email1 = await ProfileEmailsModel.writeToNewDoc(
            'profiles/john/emails',
            { address: 'john@gmail.com' }
        );
        const email2 = await ProfileEmailsModel.writeToNewDoc(
            'profiles/john/emails',
            { isValid: false }
        );

        const results = await Promise.all(map(
            [email1, email2],
            async (docRef) => {
                const doc = await ProfileEmailsModel.getByPath(docRef.path);
                return omit(doc, ['_ref', 'id', 'subcollections']);
            }
        ));

        expect(results).to.deep.equal([
            { address: 'john@gmail.com' },
            { isValid: false }
        ]);
    });

    it('can handle read and write operations in a subcollection in a transaction', async () => {
        const ProfileModel = new Model({
            collectionName: 'profiles',
            collectionProps: [ 'displayName' ]
        });

        const ProfileEmailsModel = new Submodel({
            collectionName: 'emails',
            parent: ProfileModel,
            collectionProps: [ 'address' ]
        });

        let transactionRunCount = 0;
        await ProfileEmailsModel.writeToPath(
            'profiles/john/emails/initialDoc',
            { address: 'john@gmail.com' }
        );
        await new Promise(async (parentResolve, parentReject) => {
            let interruptingPromise = new Deferred();
            let initialPromise = new Deferred();
            runTransaction(async (transaction) => {
                transactionRunCount++;
                const initialDoc = await ProfileEmailsModel.getByPath(
                    'profiles/john/emails/initialDoc',
                    { transaction }
                );
                initialPromise.resolve();
                await interruptingPromise.promise;
                await ProfileEmailsModel.writeToPath(
                    'profiles/john/emails/updatedDoc',
                    { address: initialDoc.address + '-updated' },
                    { transaction }
                );
            }).then(parentResolve);
            await initialPromise.promise;
            ProfileEmailsModel.writeToPath(
                'profiles/john/emails/initialDoc',
                { address: 'joey@gmail.com' }
            ).then(interruptingPromise.resolve);
        });
        let finalResult = await ProfileEmailsModel.getByPath('profiles/john/emails/updatedDoc');
        finalResult = omit(finalResult, ['_ref', 'subcollections']);
        const testObj = assign({}, finalResult, { transactionRunCount });
        expect(testObj).to.deep.equal({
            id: 'updatedDoc',
            address: 'joey@gmail.com-updated',
            transactionRunCount: 2
        });
    });

    it('can delete a document in a subcollection correctly', async () => {
        const results = {};

        const ProfileModel = new Model({
            collectionName: 'profiles',
            collectionProps: [ 'displayName' ],
        });
        const ProfileEmailsModel = new Submodel({
            collectionName: 'emails',
            parent: ProfileModel,
            collectionProps: [ 'address' ]
        });

        await ProfileEmailsModel.writeToPath(
            'profiles/john/emails/gmail',
            { address: 'john@gmail.com' }
        );
        results.firstReading = Boolean(
            await ProfileEmailsModel.getByPath('profiles/john/emails/gmail')
        );
        await ProfileEmailsModel.deleteByPath(
            'profiles/john/emails/gmail'
        );
        results.secondReading = Boolean(
            await ProfileEmailsModel.getByPath('profiles/john/emails/gmail')
        );
        expect(results).to.deep.equal({
            firstReading: true,
            secondReading: false
        });
    });

    it('can use `getByQuery` on first-level subcollection groups', async () => {
        const ProfileModel = new Model({
            collectionName: 'profiles',
            collectionProps: [ 'displayName' ],
        });
        const ProfileEmailsModel = new Submodel({
            collectionName: 'emails',
            parent: ProfileModel,
            collectionProps: [ 'address', 'domain' ]
        });

        await ProfileEmailsModel.writeToPath(
            'profiles/john/emails/gmail',
            { address: 'john@gmail.com', domain: 'gmail' }
        );
        await ProfileEmailsModel.writeToPath(
            'profiles/john/emails/outlook',
            { address: 'john@outlook.com', domain: 'outlook' }
        );
        await ProfileEmailsModel.writeToPath(
            'profiles/joey/emails/gmail',
            { address: 'joey@gmail.com', domain: 'gmail' }
        );

        const queryResults = await ProfileEmailsModel.getByQuery([
            where('domain', '==', 'gmail'),
            orderBy('address')
        ]);
        const results = map(queryResults, 'address');

        expect(results).to.deep.equal([
            'joey@gmail.com',
            'john@gmail.com',
        ]);
    });

    it('can use `getByQuery` on second-level subcollection groups', async () => {
        const ProfileModel = new Model({
            collectionName: 'profiles',
            collectionProps: [ 'displayName' ],
        });
        const ProfileContactInfo = new Submodel({
            collectionName: 'contactInfo',
            parent: ProfileModel,
            collectionProps: [ 'has' ],
        });
        const ProfileEmailsModel = new Submodel({
            collectionName: 'emails',
            parent: ProfileContactInfo,
            collectionProps: [ 'address', 'domain' ]
        });

        await ProfileEmailsModel.writeToPath(
            'profiles/john/contactInfo/1/emails/gmail',
            { address: 'john@gmail.com', domain: 'gmail' },
        );
        await ProfileEmailsModel.writeToPath(
            'profiles/john/contactInfo/2/emails/outlook',
            { address: 'john@outlook.com', domain: 'outlook' },
        );
        await ProfileEmailsModel.writeToPath(
            'profiles/joey/contactInfo/1/emails/gmail',
            { address: 'joey@gmail.com', domain: 'gmail' },
        );

        const queryResults = await ProfileEmailsModel.getByQuery([
            where('domain', '==', 'gmail'),
            orderBy('address')
        ]);
        const results = map(queryResults, 'address');

        expect(results).to.deep.equal([
            'joey@gmail.com',
            'john@gmail.com'
        ]);
    });

    it('can use `getByQuery` on a mix of levels for a subcollection group', async () => {
        const EmailsModel = new Model({
            collectionName: 'emails',
            collectionProps: [ 'address', 'domain' ],
        });
        const ProfileModel = new Model({
            collectionName: 'profiles',
            collectionProps: [ 'displayName' ],
        });
        const ProfileEmailsModel = new Submodel({
            collectionName: 'emails',
            parent: ProfileModel,
            collectionProps: [ 'address', 'domain' ],
        });
        const ContactInfoModel = new Submodel({
            collectionName: 'contactInfo',
            parent: ProfileModel,
            collectionProps: [ 'has' ],
        });
        const ContactInfoEmailsModel = new Submodel({
            collectionName: 'emails',
            parent: ContactInfoModel,
            collectionProps: [ 'address', 'domain' ],
        });

        await EmailsModel.writeToNewDoc({
            address: 'blank@gmail.com',
            domain: 'gmail',
        });
        await EmailsModel.writeToNewDoc({
            address: 'blank@outlook.com',
            domain: 'outlook',
        });
        await ProfileEmailsModel.writeToPath(
            'profiles/john/emails/gmail',
            {
                address: 'john@gmail.com',
                domain: 'gmail'
            }
        );
        await ProfileEmailsModel.writeToPath(
            'profiles/john/emails/outlook',
            {
                address: 'john@outlook.com',
                domain: 'outlook',
            }
        );
        await ContactInfoEmailsModel.writeToPath(
            'profiles/joey/contactInfo/1/emails/gmail',
            {
                address: 'joey@gmail.com',
                domain: 'gmail',
            }
        );
        await ContactInfoEmailsModel.writeToPath(
            'profiles/joey/contactInfo/1/emails/outlook',
            {
                address: 'joey@outlook.com',
                domain: 'outlook',
            }
        );

        const queryResults = await ProfileEmailsModel.getByQuery([
            where('domain', '==', 'gmail'),
            orderBy('address')
        ]);
        const results = map(queryResults, 'address');

        expect(results).to.deep.equal([
            'blank@gmail.com',
            'joey@gmail.com',
            'john@gmail.com'
        ]);
    });

})