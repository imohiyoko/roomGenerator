export namespace main {

	export class Project {
	    id: string;
	    name: string;
	    updatedAt: string;

	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class ProjectData {
	    assets: any[];
	    instances: any[];

	    static createFrom(source: any = {}) {
	        return new ProjectData(source);
	    }

	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.assets = source["assets"];
	        this.instances = source["instances"];
	    }
	}

}
